# KRISIS — Book de Referência Visual & UI
**Versão 1.0 · Novembro 2026**  
**Conceito: Neo Human Intelligence**

## Essência
KRISIS é uma plataforma de IA aplicada a entrevistas, descoberta de talentos e avaliação de candidatos. A marca representa a interseção entre inteligência humana, tecnologia e decisões melhores.

Personalidade: contemporânea, sofisticada, investigativa, inteligente, confiável e humana.

## Logotipo oficial
Usar exclusivamente o PNG oficial `krisis_logo_oficial_aplicacao.png` anexado ao projeto. Não redesenhar com CSS, SVG, texto ou formas. Não substituir por um X estilizado. Preservar proporção e transparência, usar `object-fit: contain`. Aplicar o mesmo asset no header, footer e ícone do app.

## Cores (tokens extraídos do CSS da landing page)
| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#0D0718` | Fundo principal |
| `--panel` | `#171025` | Cards/superfícies |
| `--panel2` | `#201331` | Superfície elevada |
| `--purple` | `#8B35E8` | Roxo primário |
| `--lav` | `#C69AFF` | Lavanda/destaque |
| `--coral` | `#FF5B7F` | Coral |
| `--orange` | `#FF8A3D` | Laranja queimado |
| `--white` | `#F7F2FF` | Texto principal |
| `--muted` | `#B8ABC9` | Texto secundário |
| `--line` | `rgba(208,174,255,.16)` | Bordas |

Gradiente: `linear-gradient(115deg, #8B35E8 0%, #ED4C9A 54%, #FF8A3D 100%)`

## Tipografia
- **Títulos:** Manrope (400–800). H1 desktop `clamp(46px, 6vw, 76px)`, weight 600, line-height 1.05, letter-spacing -0.055em.
- **Textos/UI:** DM Sans (400–700). Corpo hero 17px desktop / 15px mobile; line-height 1.8.
- H2: `clamp(34px, 4.4vw, 52px)`, line-height 1.12, letter-spacing -0.045em.
- H3/card: 19px Manrope 600. Eyebrow: 11px, 700, uppercase, letter-spacing .2em.

## Formas e superfícies
Órbitas finas, pontos luminosos, esferas abstratas, fitas orgânicas, gradientes sutis e cartões translúcidos. Evitar cérebros, robôs, pessoas genéricas e clichês de RH.
- Cards: radius 18–20px; CTA container: 28px; botões: 999px.
- Bordas: `1px solid rgba(208,174,255,.16)`.
- Glass pontual: `backdrop-filter: blur(18px)`.

## Estrutura padrão de landing page
1. Header: logo oficial, navegação e CTA.
2. Hero: eyebrow, headline, texto, CTA primário, link secundário e visual abstrato.
3. Strip de mensagens curtas.
4. Três cards de valor.
5. Produto com mockup de dashboard.
6. Como funciona em três passos: Entenda, Descubra, Decida.
7. CTA final em bloco destacado.
8. Footer com logo oficial e links.

## Botões
CTA primário: gradiente, texto branco, bold 700, 13px, padding 13px 21px, pill e sombra roxa. Hover: `translateY(-2px)` e sombra mais forte. Link secundário discreto, texto claro e seta coral. Todo botão deve ter ação real, foco visível e destino claro.

## Responsividade
Breakpoints atuais: 850px e 600px.
- Desktop: container `min(1160px, calc(100% - 48px))`; hero em duas colunas; cards em três.
- Tablet ≤850px: hero/produto em uma coluna; cards em duas.
- Mobile ≤600px: container `min(100% - 36px, 480px)`; logo 52px; H1 48px; cards em uma coluna; seções com 70px de padding.

## CSS base
```css
:root {
  --bg:#0D0718; --panel:#171025; --panel2:#201331;
  --purple:#8B35E8; --lav:#C69AFF; --coral:#FF5B7F;
  --orange:#FF8A3D; --white:#F7F2FF; --muted:#B8ABC9;
  --line:rgba(208,174,255,.16);
  --grad:linear-gradient(115deg,#8B35E8 0%,#ED4C9A 54%,#FF8A3D 100%);
}
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--white);
  font-family:'DM Sans',sans-serif; line-height:1.55; }
h1,h2,h3 { font-family:'Manrope',sans-serif; }
.wrap { width:min(1160px,calc(100% - 48px)); margin:auto; }
```

## Prompt para outra sessão
Continue o projeto KRISIS usando este Book como fonte de verdade. Preserve rigorosamente o PNG oficial do logo anexado: não redesenhe, não substitua por SVG/CSS e não crie um X alternativo. Use Manrope para títulos e DM Sans para textos. Respeite os tokens de cor, gradiente, raios, padrões de seção, botões e breakpoints. Antes de alterar páginas existentes, inspecione o HTML e confirme que está usando o asset correto. Mantenha desktop, tablet e mobile consistentes. Não invente novos elementos de marca sem aprovação.

**Anexos recomendados na nova sessão:** PDF, Markdown, `krisis_logo_oficial_aplicacao.png` e o HTML mais recente.
