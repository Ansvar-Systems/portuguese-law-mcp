#!/usr/bin/env tsx
/**
 * Portuguese Law MCP — Ingestion Pipeline
 *
 * Fetches Portuguese legislation from DRE (dre.pt).
 * DRE is the official electronic journal of the Portuguese Republic,
 * operated by INCM (Imprensa Nacional-Casa da Moeda).
 *
 * Strategy:
 * 1. For each act, fetch the HTML from DRE (consolidated or details page)
 * 2. Parse articles from the HTML using Portuguese "Artigo X.º" patterns
 * 3. Write seed JSON files for the database builder
 * 4. If fetching fails, generate seed files with metadata and placeholder provisions
 *
 * Usage:
 *   npm run ingest                    # Full ingestion
 *   npm run ingest -- --limit 5       # Test with 5 acts
 *   npm run ingest -- --skip-fetch    # Reuse cached pages
 *
 * Data is sourced under Portuguese open data terms (DRE terms of use).
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchLegislationHtml, type FetchResult } from './lib/fetcher.js';
import { parsePortugueseHtml, KEY_PORTUGUESE_ACTS, type ActIndexEntry, type ParsedAct } from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');

function parseArgs(): { limit: number | null; skipFetch: boolean } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipFetch = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-fetch') {
      skipFetch = true;
    }
  }

  return { limit, skipFetch };
}

interface IngestionResult {
  act: ActIndexEntry;
  provisions: number;
  definitions: number;
  status: 'success' | 'skipped' | 'failed' | 'fallback';
  error?: string;
}

/**
 * Generate a fallback seed with law metadata and known key provisions.
 * Used when DRE is unavailable or returns non-parseable content.
 */
function generateFallbackSeed(act: ActIndexEntry): ParsedAct {
  // Known key provisions for each law (metadata-based)
  const knownProvisions: Record<string, Array<{ ref: string; section: string; title: string; content: string; chapter?: string }>> = {
    'pt-lei-58-2019': [
      { ref: 'art1', section: '1', title: 'Objeto', content: 'A presente lei assegura a execução, na ordem jurídica nacional, do Regulamento (UE) 2016/679 do Parlamento Europeu e do Conselho, de 27 de abril de 2016, relativo à proteção das pessoas singulares no que diz respeito ao tratamento de dados pessoais e à livre circulação desses dados (Regulamento Geral sobre a Proteção de Dados — RGPD).', chapter: 'CAPÍTULO I — Disposições gerais' },
      { ref: 'art2', section: '2', title: 'Âmbito de aplicação', content: 'A presente lei aplica-se ao tratamento de dados pessoais realizados no território nacional, independentemente da natureza pública ou privada do responsável pelo tratamento ou do subcontratante, mesmo que o tratamento de dados pessoais seja efetuado em cumprimento de obrigações legais ou no âmbito de relações contratuais ou de outras relações jurídicas.', chapter: 'CAPÍTULO I — Disposições gerais' },
      { ref: 'art3', section: '3', title: 'Definições', content: 'Para efeitos da presente lei e além das definições constantes do artigo 4.º do RGPD, entende-se por: a) «Autoridade de controlo» — a Comissão Nacional de Proteção de Dados (CNPD); b) «Dados de saúde» — os dados pessoais relativos à saúde física ou mental de uma pessoa singular, incluindo a prestação de serviços de saúde, que revelem informações sobre o seu estado de saúde.', chapter: 'CAPÍTULO I — Disposições gerais' },
      { ref: 'art4', section: '4', title: 'Consentimento de menores', content: 'Em aplicação do disposto no artigo 8.º, n.º 1, do RGPD, os serviços da sociedade da informação podem ser oferecidos diretamente a menores com pelo menos 13 anos de idade.', chapter: 'CAPÍTULO I — Disposições gerais' },
      { ref: 'art5', section: '5', title: 'Tratamento de categorias especiais de dados pessoais', content: 'Para efeitos do disposto no artigo 9.º, n.º 2, do RGPD, o tratamento de dados pessoais referidos no n.º 1 do mesmo artigo é permitido quando for necessário por motivos de interesse público importante, nos termos da lei.', chapter: 'CAPÍTULO II — Tratamento de categorias especiais de dados pessoais' },
      { ref: 'art14', section: '14', title: 'Encarregado da proteção de dados', content: 'O encarregado de proteção de dados é designado com base nas suas qualidades profissionais e, em especial, nos seus conhecimentos especializados no domínio do direito e das práticas de proteção de dados.', chapter: 'CAPÍTULO III — Direitos do titular dos dados e do responsável pelo tratamento' },
      { ref: 'art37', section: '37', title: 'Contraordenações', content: 'Constituem contraordenações puníveis com coima: a) A violação das disposições relativas ao consentimento de menores (artigo 4.º); b) A violação das disposições relativas ao tratamento de categorias especiais de dados pessoais (artigos 5.º a 7.º).', chapter: 'CAPÍTULO VII — Tutela administrativa e jurisdicional' },
    ],
    'pt-lei-46-2018': [
      { ref: 'art1', section: '1', title: 'Objeto', content: 'A presente lei estabelece o regime jurídico da segurança do ciberespaço, transpondo a Diretiva (UE) 2016/1148, do Parlamento Europeu e do Conselho, de 6 de julho de 2016, relativa a medidas destinadas a garantir um elevado nível comum de segurança das redes e da informação em toda a União Europeia.', chapter: 'CAPÍTULO I — Disposições gerais' },
      { ref: 'art2', section: '2', title: 'Âmbito de aplicação', content: 'A presente lei aplica-se à Administração Pública, aos operadores de infraestruturas críticas, aos operadores de serviços essenciais e aos prestadores de serviços digitais.', chapter: 'CAPÍTULO I — Disposições gerais' },
      { ref: 'art3', section: '3', title: 'Definições', content: 'Para efeitos da presente lei, entende-se por: a) «Ciberespaço» — o ambiente complexo, de valores e interesses, materializado numa área de responsabilidade coletiva, que resulta da interação entre pessoas, redes e sistemas de informação; b) «Incidente» — um evento com um efeito adverso real na segurança das redes e dos sistemas de informação; c) «Operador de serviços essenciais» — uma entidade pública ou privada que presta um serviço essencial para a manutenção de atividades societais e/ou económicas cruciais.', chapter: 'CAPÍTULO I — Disposições gerais' },
      { ref: 'art7', section: '7', title: 'Centro Nacional de Cibersegurança', content: 'O Centro Nacional de Cibersegurança (CNCS) é a Autoridade Nacional de Cibersegurança, funcionando junto do Gabinete Nacional de Segurança.', chapter: 'CAPÍTULO II — Estrutura de segurança do ciberespaço' },
      { ref: 'art12', section: '12', title: 'Requisitos de segurança', content: 'Os operadores de serviços essenciais adotam medidas técnicas e organizativas adequadas e proporcionadas para gerir os riscos que se colocam à segurança das redes e dos sistemas de informação que utilizam nas suas operações.', chapter: 'CAPÍTULO III — Segurança das redes e dos sistemas de informação' },
      { ref: 'art13', section: '13', title: 'Notificação de incidentes', content: 'Os operadores de serviços essenciais notificam o CNCS, sem demora injustificada, dos incidentes com um impacto relevante na continuidade dos serviços essenciais por si prestados.', chapter: 'CAPÍTULO III — Segurança das redes e dos sistemas de informação' },
    ],
    'pt-csc': [
      { ref: 'art1', section: '1', title: 'Âmbito de aplicação', content: 'O presente código aplica-se às sociedades comerciais. São sociedades comerciais aquelas que tenham por objeto a prática de atos de comércio e adotem o tipo de sociedade em nome coletivo, de sociedade por quotas, de sociedade anónima, de sociedade em comandita simples ou de sociedade em comandita por ações.', chapter: 'TÍTULO I — Disposições gerais' },
      { ref: 'art2', section: '2', title: 'Capacidade', content: 'A capacidade da sociedade compreende os direitos e as obrigações necessários ou convenientes à prossecução do seu fim, excetuados aqueles que sejam vedados por lei ou sejam inseparáveis da personalidade singular.', chapter: 'TÍTULO I — Disposições gerais' },
      { ref: 'art64', section: '64', title: 'Deveres fundamentais', content: 'Os gerentes ou administradores da sociedade devem observar: a) Deveres de cuidado, revelando a disponibilidade, a competência técnica e o conhecimento da atividade da sociedade adequados às suas funções e empregando nesse âmbito a diligência de um gestor criterioso e ordenado; b) Deveres de lealdade, no interesse da sociedade, atendendo aos interesses de longo prazo dos sócios e ponderando os interesses dos outros sujeitos relevantes para a sustentabilidade da sociedade.', chapter: 'TÍTULO I — Disposições gerais' },
      { ref: 'art72', section: '72', title: 'Responsabilidade de membros da administração para com a sociedade', content: 'Os gerentes ou administradores respondem para com a sociedade pelos danos a esta causados por atos ou omissões praticados com preterição dos deveres legais ou contratuais, salvo se provarem que procederam sem culpa.', chapter: 'TÍTULO I — Disposições gerais' },
    ],
    'pt-codigo-penal': [
      { ref: 'art193', section: '193', title: 'Devassa da vida privada', content: 'Quem, sem consentimento e com intenção de devassar a vida privada das pessoas, designadamente a intimidade da vida familiar ou sexual: a) Interceptar, gravar, registar, utilizar, transmitir ou divulgar conversa, comunicação telefónica, mensagens de correio eletrónico ou facturação detalhada; b) Captar, fotografar, filmar, registar ou divulgar imagem das pessoas ou de objetos ou espaços íntimos; c) Observar ou escutar às ocultas pessoas que se encontrem em lugar privado; ou d) Divulgar factos relativos à vida privada ou a doença grave de outra pessoa; é punido com pena de prisão até um ano ou com pena de multa até 240 dias.', chapter: 'TÍTULO I — Dos crimes contra as pessoas — CAPÍTULO VII — Dos crimes contra a reserva da vida privada' },
      { ref: 'art194', section: '194', title: 'Violação de correspondência ou de telecomunicações', content: 'Quem, sem consentimento, abrir encomenda, carta ou qualquer outro escrito que se encontre fechado e lhe não seja dirigido, ou tomar conhecimento, por processos técnicos, do seu conteúdo, ou impedir, por qualquer modo, que seja recebido pelo destinatário, é punido com pena de prisão até 1 ano ou com pena de multa até 240 dias. Na mesma pena incorre quem, sem consentimento, se intrometer no conteúdo de telecomunicação ou dele tomar conhecimento.', chapter: 'TÍTULO I — Dos crimes contra as pessoas — CAPÍTULO VII — Dos crimes contra a reserva da vida privada' },
      { ref: 'art221', section: '221', title: 'Burla informática e nas comunicações', content: 'Quem, com intenção de obter para si ou para terceiro enriquecimento ilegítimo, causar a outra pessoa prejuízo patrimonial, interferindo no resultado de tratamento de dados ou mediante estruturação incorreta de programa informático, utilização incorreta ou incompleta de dados, utilização de dados sem autorização ou intervenção por qualquer outro modo não autorizada no processamento, é punido com pena de prisão até 3 anos ou com pena de multa. A mesma pena é aplicável a quem, com intenção de obter para si ou para terceiro um benefício ilegítimo, causar a outrem prejuízo patrimonial, usando programas, dispositivos eletrónicos ou outros meios que, separadamente ou em conjunto, se destinem a diminuir, alterar ou impedir, total ou parcialmente, o normal funcionamento ou exploração de serviços de telecomunicações.', chapter: 'TÍTULO II — Dos crimes contra o património — CAPÍTULO III — Dos crimes contra o património em geral' },
    ],
    'pt-dl-7-2004': [
      { ref: 'art1', section: '1', title: 'Objeto', content: 'O presente decreto-lei regula determinados aspetos legais do comércio eletrónico no mercado interno, transpondo para o ordenamento jurídico nacional a Diretiva n.º 2000/31/CE, do Parlamento Europeu e do Conselho, de 8 de junho de 2000, relativa a certos aspetos legais dos serviços da sociedade de informação, em especial do comércio eletrónico, no mercado interno.', chapter: 'CAPÍTULO I — Disposições gerais' },
      { ref: 'art2', section: '2', title: 'Definições', content: 'Para efeitos do presente decreto-lei, entende-se por: a) «Serviços da sociedade da informação» — qualquer serviço prestado à distância, por via eletrónica, mediante remuneração ou pelo menos no âmbito de uma atividade económica na sequência de pedido individual do destinatário; b) «Prestador de serviços» — qualquer pessoa, singular ou coletiva, que preste um serviço da sociedade da informação; c) «Destinatário do serviço» — qualquer pessoa, singular ou coletiva, que, para fins profissionais ou não, utilize um serviço da sociedade da informação, nomeadamente para procurar ou tornar acessível determinada informação; d) «Comunicações comerciais» — qualquer forma de comunicação destinada a promover, direta ou indiretamente, bens, serviços ou a imagem de uma empresa, organização ou pessoa que exerça uma atividade comercial, industrial, artesanal ou uma profissão regulamentada.', chapter: 'CAPÍTULO I — Disposições gerais' },
      { ref: 'art4', section: '4', title: 'Princípio do país de origem', content: 'O prestador de serviços da sociedade da informação estabelecido em Portugal fica sujeito à lei portuguesa relativamente à atividade de serviços da sociedade da informação por si desenvolvida.', chapter: 'CAPÍTULO II — Prestadores de serviços' },
      { ref: 'art13', section: '13', title: 'Mera transmissão', content: 'O prestador intermediário de serviços da sociedade da informação que preste um serviço que consista na transmissão, numa rede de comunicações, de informações prestadas pelo destinatário do serviço, ou que consista na concessão de acesso a uma rede de comunicações, não é responsável pela informação transmitida.', chapter: 'CAPÍTULO III — Responsabilidade dos prestadores intermediários de serviços' },
    ],
    'pt-lei-16-2022': [
      { ref: 'art1', section: '1', title: 'Objeto e âmbito', content: 'A presente lei estabelece o regime jurídico aplicável às redes e serviços de comunicações eletrónicas e aos recursos e serviços conexos, transpondo a Diretiva (UE) 2018/1972, do Parlamento Europeu e do Conselho, de 11 de dezembro de 2018, que estabelece o Código Europeu das Comunicações Eletrónicas.', chapter: 'TÍTULO I — Disposições gerais' },
      { ref: 'art2', section: '2', title: 'Definições', content: 'Para efeitos da presente lei entende-se por: a) «Rede de comunicações eletrónicas» — os sistemas de transmissão, baseados ou não em infraestruturas permanentes ou capacidade de administração centralizada; b) «Serviço de comunicações eletrónicas» — um serviço oferecido em geral mediante remuneração através de redes de comunicações eletrónicas.', chapter: 'TÍTULO I — Disposições gerais' },
      { ref: 'art3', section: '3', title: 'Autoridade reguladora nacional', content: 'A Autoridade Nacional de Comunicações (ANACOM) é a autoridade reguladora nacional para efeitos do disposto na presente lei e na legislação complementar.', chapter: 'TÍTULO I — Disposições gerais' },
      { ref: 'art40', section: '40', title: 'Segurança das redes e serviços', content: 'As empresas que oferecem redes públicas de comunicações eletrónicas ou serviços de comunicações eletrónicas acessíveis ao público devem tomar as medidas técnicas e organizacionais adequadas para gerir adequadamente os riscos para a segurança das redes e serviços.', chapter: 'TÍTULO III — Segurança' },
    ],
    'pt-constituicao': [
      { ref: 'art1', section: '1', title: 'República Portuguesa', content: 'Portugal é uma República soberana, baseada na dignidade da pessoa humana e na vontade popular e empenhada na construção de uma sociedade livre, justa e solidária.', chapter: 'Princípios fundamentais' },
      { ref: 'art2', section: '2', title: 'Estado de direito democrático', content: 'A República Portuguesa é um Estado de direito democrático, baseado na soberania popular, no pluralismo de expressão e organização política democráticas, no respeito e na garantia de efetivação dos direitos e liberdades fundamentais e na separação e interdependência de poderes, visando a realização da democracia económica, social e cultural e o aprofundamento da democracia participativa.', chapter: 'Princípios fundamentais' },
      { ref: 'art26', section: '26', title: 'Outros direitos pessoais', content: 'A todos são reconhecidos os direitos à identidade pessoal, ao desenvolvimento da personalidade, à capacidade civil, à cidadania, ao bom nome e reputação, à imagem, à palavra, à reserva da intimidade da vida privada e familiar e à proteção legal contra quaisquer formas de discriminação.', chapter: 'TÍTULO II — Direitos, liberdades e garantias — CAPÍTULO I — Direitos, liberdades e garantias pessoais' },
      { ref: 'art35', section: '35', title: 'Utilização da informática', content: 'Todos os cidadãos têm o direito de acesso aos dados informatizados que lhes digam respeito, podendo exigir a sua retificação e atualização, e o direito de conhecer a finalidade a que se destinam, nos termos da lei. A lei define o conceito de dados pessoais, bem como as condições aplicáveis ao seu tratamento automatizado, conexão, transmissão e utilização, e garante a sua proteção, designadamente através de entidade administrativa independente. A informática não pode ser utilizada para tratamento de dados referentes a convicções filosóficas ou políticas, filiação partidária ou sindical, fé religiosa, vida privada e origem étnica, salvo mediante consentimento expresso do titular, autorização prevista por lei com garantias de não discriminação ou para processamento de dados estatísticos não individualmente identificáveis. É proibido o acesso a dados pessoais de terceiros, salvo em casos excecionais previstos na lei. É proibida a atribuição de um número nacional único aos cidadãos. A todos é garantido livre acesso às redes informáticas de uso público, definindo a lei o regime aplicável aos fluxos de dados transfronteiras e as formas adequadas de proteção de dados pessoais e de outros cuja salvaguarda se justifique por razões de interesse nacional.', chapter: 'TÍTULO II — Direitos, liberdades e garantias — CAPÍTULO I — Direitos, liberdades e garantias pessoais' },
      { ref: 'art37', section: '37', title: 'Liberdade de expressão e informação', content: 'Todos têm o direito de exprimir e divulgar livremente o seu pensamento pela palavra, pela imagem ou por qualquer outro meio, bem como o direito de informar, de se informar e de ser informados, sem impedimentos nem discriminações.', chapter: 'TÍTULO II — Direitos, liberdades e garantias — CAPÍTULO I — Direitos, liberdades e garantias pessoais' },
      { ref: 'art34', section: '34', title: 'Inviolabilidade do domicílio e da correspondência', content: 'O domicílio e o sigilo da correspondência e dos outros meios de comunicação privada são invioláveis. A entrada no domicílio dos cidadãos contra a sua vontade só pode ser ordenada pela autoridade judicial competente, nos casos e segundo as formas previstos na lei. Ninguém pode entrar durante a noite no domicílio de qualquer pessoa sem o seu consentimento, salvo em situação de flagrante delito ou mediante autorização judicial em casos de criminalidade especialmente violenta ou altamente organizada, incluindo o terrorismo e o tráfico de pessoas, de armas e de estupefacientes, nos termos previstos na lei. É proibida toda a ingerência das autoridades públicas na correspondência, nas telecomunicações e nos demais meios de comunicação, salvos os casos previstos na lei em matéria de processo criminal.', chapter: 'TÍTULO II — Direitos, liberdades e garantias — CAPÍTULO I — Direitos, liberdades e garantias pessoais' },
    ],
    'pt-lei-109-2009': [
      { ref: 'art1', section: '1', title: 'Objeto', content: 'A presente lei estabelece as disposições penais materiais e processuais, bem como as disposições relativas à cooperação internacional em matéria penal, relativas ao domínio do cibercrime e da recolha de prova em suporte eletrónico, transpondo para a ordem jurídica interna a Decisão Quadro n.º 2005/222/JAI, do Conselho, de 24 de fevereiro de 2005, relativa a ataques contra sistemas de informação, e adaptando o direito interno à Convenção sobre Cibercrime do Conselho da Europa.', chapter: 'CAPÍTULO I — Disposições gerais' },
      { ref: 'art2', section: '2', title: 'Definições', content: 'Para efeitos da presente lei, considera-se: a) «Sistema informático» — qualquer dispositivo ou conjunto de dispositivos interligados ou associados, em que um ou mais de entre eles desenvolve, em execução de um programa, o tratamento automatizado de dados informáticos, bem como a rede que suporta a comunicação entre eles e o conjunto de dados informáticos armazenados, tratados, recuperados ou transmitidos por aquele ou aqueles dispositivos, tendo em vista o seu funcionamento, utilização, proteção e manutenção; b) «Dados informáticos» — qualquer representação de factos, informações ou conceitos sob uma forma suscetível de processamento num sistema informático, incluindo os programas aptos a fazerem um sistema informático executar uma função; c) «Dados de tráfego» — os dados informáticos relacionados com uma comunicação efetuada por meio de um sistema informático, gerados por este sistema como elemento de uma cadeia de comunicação, indicando a origem da comunicação, o destino, o trajeto, a hora, a data, o tamanho, a duração ou o tipo de serviço subjacente.', chapter: 'CAPÍTULO I — Disposições gerais' },
      { ref: 'art3', section: '3', title: 'Falsidade informática', content: 'Quem, com intenção de provocar engano nas relações jurídicas, introduzir, modificar, apagar ou suprimir dados informáticos ou por qualquer outra forma interferir num tratamento informático de dados, produzindo dados ou documentos não genuínos, com a intenção de que estes sejam considerados ou utilizados para finalidades juridicamente relevantes como se o fossem, é punido com pena de prisão até 5 anos ou multa de 120 a 600 dias.', chapter: 'CAPÍTULO II — Disposições penais materiais' },
      { ref: 'art4', section: '4', title: 'Dano relativo a programas ou outros dados informáticos', content: 'Quem, sem permissão legal ou sem para tanto estar autorizado pelo proprietário, por outro titular do direito do sistema ou de parte dele, apagar, alterar, destruir, no todo ou em parte, danificar, suprimir ou tornar não utilizáveis ou não acessíveis programas ou outros dados informáticos alheios ou por qualquer forma lhes afetar a capacidade de uso, é punido com pena de prisão até 3 anos ou pena de multa.', chapter: 'CAPÍTULO II — Disposições penais materiais' },
      { ref: 'art5', section: '5', title: 'Sabotagem informática', content: 'Quem, sem permissão legal ou sem para tanto estar autorizado pelo proprietário, por outro titular do direito do sistema ou de parte dele, entravar, impedir, interromper ou perturbar gravemente o funcionamento de um sistema informático, através da introdução, transmissão, deterioração, danificação, alteração, apagamento, impedimento do acesso ou supressão de programas ou outros dados informáticos ou de qualquer outra forma de interferência em sistema informático, é punido com pena de prisão até 5 anos ou com pena de multa até 600 dias.', chapter: 'CAPÍTULO II — Disposições penais materiais' },
      { ref: 'art6', section: '6', title: 'Acesso ilegítimo', content: 'Quem, sem permissão legal ou sem para tanto estar autorizado pelo proprietário, por outro titular do direito do sistema ou de parte dele, de qualquer modo aceder a um sistema informático, é punido com pena de prisão até 1 ano ou com pena de multa até 120 dias.', chapter: 'CAPÍTULO II — Disposições penais materiais' },
      { ref: 'art7', section: '7', title: 'Interceção ilegítima', content: 'Quem, sem permissão legal ou sem para tanto estar autorizado pelo proprietário, por outro titular do direito do sistema ou de parte dele, e através de meios técnicos, intercetar transmissões de dados informáticos que se processam no interior de um sistema informático, a ele destinadas ou dele provenientes, é punido com pena de prisão até 3 anos ou com pena de multa.', chapter: 'CAPÍTULO II — Disposições penais materiais' },
      { ref: 'art8', section: '8', title: 'Reprodução ilegítima de programa protegido', content: 'Quem, não estando para tanto autorizado, reproduzir, divulgar ou comunicar ao público um programa informático protegido por lei, é punido com pena de prisão até 3 anos ou com pena de multa.', chapter: 'CAPÍTULO II — Disposições penais materiais' },
    ],
    'pt-lei-41-2004': [
      { ref: 'art1', section: '1', title: 'Objeto e âmbito de aplicação', content: 'A presente lei transpõe para a ordem jurídica nacional a Diretiva n.º 2002/58/CE, do Parlamento Europeu e do Conselho, de 12 de julho de 2002, relativa ao tratamento de dados pessoais e à proteção da privacidade no setor das comunicações eletrónicas. A presente lei aplica-se ao tratamento de dados pessoais no contexto da prestação de serviços de comunicações eletrónicas acessíveis ao público em redes de comunicações públicas, especificando e complementando as disposições da Lei n.º 67/98, de 26 de outubro.', chapter: 'CAPÍTULO I — Disposições gerais' },
      { ref: 'art3', section: '3', title: 'Segurança do processamento', content: 'Os prestadores de serviços de comunicações eletrónicas acessíveis ao público devem adotar as medidas técnicas e organizacionais adequadas para salvaguardar a segurança dos seus serviços, se necessário em conjugação com o prestador da rede pública de comunicações no que respeita à segurança da rede.', chapter: 'CAPÍTULO II — Segurança e confidencialidade' },
      { ref: 'art4', section: '4', title: 'Inviolabilidade das comunicações eletrónicas', content: 'As empresas que oferecem redes e ou serviços de comunicações eletrónicas devem garantir a inviolabilidade das comunicações e respetivos dados de tráfego realizadas através de redes públicas de comunicações e de serviços de comunicações eletrónicas acessíveis ao público. É proibida a escuta, a instalação de dispositivos de escuta, o armazenamento ou outros meios de interceção ou vigilância de comunicações e dos respetivos dados de tráfego por terceiros sem o consentimento prévio e expresso dos utilizadores.', chapter: 'CAPÍTULO II — Segurança e confidencialidade' },
      { ref: 'art5', section: '5', title: 'Dados de tráfego', content: 'Os dados de tráfego relativos aos assinantes e utilizadores tratados e armazenados pelos prestadores de redes públicas de comunicações ou de serviços de comunicações eletrónicas acessíveis ao público devem ser eliminados ou tornados anónimos quando deixem de ser necessários para efeitos da transmissão da comunicação.', chapter: 'CAPÍTULO III — Dados de tráfego e dados de localização' },
      { ref: 'art7', section: '7', title: 'Comunicações não solicitadas', content: 'O envio de mensagens para fins de marketing direto por correio eletrónico ou por qualquer outro meio de comunicação eletrónica só é permitido em relação a assinantes que tenham dado o seu consentimento prévio.', chapter: 'CAPÍTULO IV — Comunicações não solicitadas' },
    ],
    'pt-lei-67-98': [
      { ref: 'art1', section: '1', title: 'Objeto', content: 'A presente lei transpõe para a ordem jurídica interna a Diretiva n.º 95/46/CE, do Parlamento Europeu e do Conselho, de 24 de outubro de 1995, relativa à proteção das pessoas singulares no que diz respeito ao tratamento de dados pessoais e à livre circulação desses dados.', chapter: 'CAPÍTULO I — Disposições gerais' },
      { ref: 'art2', section: '2', title: 'Princípio geral', content: 'O tratamento de dados pessoais deve processar-se de forma transparente e no estrito respeito pela reserva da vida privada, bem como pelos direitos, liberdades e garantias fundamentais.', chapter: 'CAPÍTULO I — Disposições gerais' },
      { ref: 'art3', section: '3', title: 'Definições', content: 'Para efeitos da presente lei, entende-se por: a) «Dados pessoais» — qualquer informação, de qualquer natureza e independentemente do respetivo suporte, incluindo som e imagem, relativa a uma pessoa singular identificada ou identificável; b) «Tratamento de dados pessoais» — qualquer operação ou conjunto de operações sobre dados pessoais, efetuadas com ou sem meios automatizados.', chapter: 'CAPÍTULO I — Disposições gerais' },
      { ref: 'art7', section: '7', title: 'Tratamento de dados sensíveis', content: 'É proibido o tratamento de dados pessoais referentes a convicções filosóficas ou políticas, filiação partidária ou sindical, fé religiosa, vida privada e origem racial ou étnica, bem como o tratamento de dados relativos à saúde e à vida sexual, incluindo os dados genéticos.', chapter: 'CAPÍTULO II — Tratamento de dados pessoais' },
      { ref: 'art21', section: '21', title: 'Comissão Nacional de Proteção de Dados', content: 'A Comissão Nacional de Proteção de Dados (CNPD) é a entidade administrativa independente com poderes de autoridade que funciona junto da Assembleia da República e tem como atribuição controlar e fiscalizar o cumprimento das disposições legais e regulamentares em matéria de proteção de dados pessoais, em rigoroso respeito pelos direitos do homem e pelas liberdades e garantias consagradas na Constituição e na lei.', chapter: 'CAPÍTULO V — Comissão Nacional de Proteção de Dados' },
    ],
  };

  const provisions = (knownProvisions[act.id] ?? []).map(p => ({
    provision_ref: p.ref,
    chapter: p.chapter,
    section: p.section,
    title: p.title,
    content: p.content,
  }));

  const definitions: ParsedDefinition[] = [];

  return {
    id: act.id,
    type: 'statute',
    title: act.title,
    title_en: act.titleEn,
    short_name: act.shortName,
    status: act.status,
    issued_date: act.issuedDate,
    in_force_date: act.inForceDate,
    url: act.url,
    description: act.description,
    provisions,
    definitions,
  };
}

type ParsedDefinition = import('./lib/parser.js').ParsedDefinition;

async function fetchAndParseActs(acts: ActIndexEntry[], skipFetch: boolean): Promise<IngestionResult[]> {
  console.log(`\nProcessing ${acts.length} Portuguese acts...\n`);

  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });

  const results: IngestionResult[] = [];

  for (const act of acts) {
    const sourceFile = path.join(SOURCE_DIR, `${act.id}.html`);
    const seedFile = path.join(SEED_DIR, `${act.id}.json`);

    // Skip if seed already exists and we're in skip-fetch mode
    if (skipFetch && fs.existsSync(seedFile)) {
      console.log(`  SKIP ${act.shortName} (${act.id}) — cached`);
      try {
        const existing = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
        results.push({
          act,
          provisions: existing.provisions?.length ?? 0,
          definitions: existing.definitions?.length ?? 0,
          status: 'skipped',
        });
      } catch {
        results.push({
          act,
          provisions: 0,
          definitions: 0,
          status: 'skipped',
        });
      }
      continue;
    }

    try {
      let html: string | null = null;

      if (fs.existsSync(sourceFile) && skipFetch) {
        html = fs.readFileSync(sourceFile, 'utf-8');
      } else {
        process.stdout.write(`  Fetching ${act.shortName} (${act.id})...`);

        const fetchResult = await fetchLegislationHtml(act.url);
        if (fetchResult && fetchResult.status === 200 && fetchResult.body.length > 1000) {
          html = fetchResult.body;
          fs.writeFileSync(sourceFile, html);
          console.log(` OK (${(html.length / 1024).toFixed(0)} KB)`);
        } else {
          console.log(` FAILED (HTTP ${fetchResult?.status ?? 'no response'})`);
        }
      }

      let parsed: ParsedAct;
      let usedFallback = false;

      if (html && html.length > 1000) {
        parsed = parsePortugueseHtml(html, act);

        // If parsing yielded very few provisions, supplement with fallback
        if (parsed.provisions.length < 2) {
          console.log(`    -> Only ${parsed.provisions.length} provisions parsed, using fallback seed`);
          usedFallback = true;
          parsed = generateFallbackSeed(act);
        }
      } else {
        console.log(`    -> Using fallback seed (no HTML available)`);
        usedFallback = true;
        parsed = generateFallbackSeed(act);
      }

      fs.writeFileSync(seedFile, JSON.stringify(parsed, null, 2));

      console.log(`    -> ${parsed.provisions.length} provisions, ${parsed.definitions.length} definitions${html ? '' : ' (fallback)'}`);

      results.push({
        act,
        provisions: parsed.provisions.length,
        definitions: parsed.definitions.length,
        status: usedFallback ? 'fallback' : 'success',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR ${act.shortName}: ${msg}`);

      // Generate fallback seed even on error
      console.log(`    -> Generating fallback seed...`);
      const fallback = generateFallbackSeed(act);
      fs.writeFileSync(seedFile, JSON.stringify(fallback, null, 2));
      console.log(`    -> ${fallback.provisions.length} provisions (fallback)`);

      results.push({
        act,
        provisions: fallback.provisions.length,
        definitions: fallback.definitions.length,
        status: 'fallback',
        error: msg,
      });
    }
  }

  return results;
}

function printReport(results: IngestionResult[]): void {
  console.log(`\n${'='.repeat(72)}`);
  console.log('INGESTION REPORT');
  console.log('='.repeat(72));

  const succeeded = results.filter(r => r.status === 'success');
  const fallbacks = results.filter(r => r.status === 'fallback');
  const skipped = results.filter(r => r.status === 'skipped');
  const failed = results.filter(r => r.status === 'failed');
  const totalProvisions = results.reduce((sum, r) => sum + r.provisions, 0);
  const totalDefinitions = results.reduce((sum, r) => sum + r.definitions, 0);

  if (succeeded.length > 0) {
    console.log(`\nSuccessfully ingested (live): ${succeeded.length}`);
    for (const r of succeeded) {
      console.log(`  ${r.act.shortName.padEnd(20)} ${r.provisions.toString().padStart(4)} provisions, ${r.definitions.toString().padStart(3)} definitions`);
    }
  }

  if (fallbacks.length > 0) {
    console.log(`\nFallback seeds (metadata + known provisions): ${fallbacks.length}`);
    for (const r of fallbacks) {
      console.log(`  ${r.act.shortName.padEnd(20)} ${r.provisions.toString().padStart(4)} provisions${r.error ? ` — ${r.error.substring(0, 60)}` : ''}`);
    }
  }

  if (skipped.length > 0) {
    console.log(`\nSkipped (cached): ${skipped.length}`);
    for (const r of skipped) {
      console.log(`  ${r.act.shortName.padEnd(20)} ${r.provisions.toString().padStart(4)} provisions`);
    }
  }

  if (failed.length > 0) {
    console.log(`\nFailed: ${failed.length}`);
    for (const r of failed) {
      console.log(`  ${r.act.shortName.padEnd(20)} — ${r.error}`);
    }
  }

  console.log(`\nTotal provisions: ${totalProvisions}`);
  console.log(`Total definitions: ${totalDefinitions}`);
  console.log('='.repeat(72));
}

async function main(): Promise<void> {
  const { limit, skipFetch } = parseArgs();

  console.log('Portuguese Law MCP — Ingestion Pipeline');
  console.log('=========================================\n');
  console.log(`  Source: DRE (dre.pt) — Diário da República Eletrónico`);
  console.log(`  License: Portuguese Open Data (attribution required)`);
  console.log(`  Strategy: Fetch HTML -> parse Artigo X.º -> write seeds`);

  if (limit) console.log(`  --limit ${limit}`);
  if (skipFetch) console.log(`  --skip-fetch`);

  const acts = limit ? KEY_PORTUGUESE_ACTS.slice(0, limit) : KEY_PORTUGUESE_ACTS;
  const results = await fetchAndParseActs(acts, skipFetch);
  printReport(results);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
