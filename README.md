# duo-wide

Сайт на всю ширину сложенного iPhone Duo в Safari, включая область под боковой панелью браузера.

**Демо:** https://pro-verstka.github.io/duo-wide/

<table>
  <tr>
    <th>До</th>
    <th>После</th>
  </tr>
  <tr>
    <td><img src="screenshots/portrait-before.png" width="260" alt="Без DuoWide: страница обрывается на краю боковой панели Safari справа" /></td>
    <td><img src="screenshots/portrait-after.png" width="260" alt="С DuoWide: страница уходит под боковую панель Safari справа" /></td>
  </tr>
  <tr>
    <td><img src="screenshots/landscape-before.png" width="380" alt="Без DuoWide: в ландшафте под панелью слева пустая полоса" /></td>
    <td><img src="screenshots/landscape-after.png" width="380" alt="С DuoWide: в ландшафте страница уходит под панель слева" /></td>
  </tr>
</table>

## Проблема

На сложенном iPhone Duo Safari держит сбоку панель шириной 84pt — всегда со стороны камеры: в портрете и в `landscape-secondary` справа, в `landscape-primary` слева. Это интерфейс браузера, а не safe-area: страница получает 382px при экране 466px, `env(safe-area-inset-*)` равны 0, `viewport-fit=cover` не помогает. Вёрстка, `position: fixed` и `sticky` обрываются на краю панели.

## Как работает

- **Только Safari на iOS.** На Android и в других браузерах на iOS (Chrome, Firefox, Edge и др.) класс ничего не делает: решение рассчитано на интерфейс Safari. Проверка — по user agent, доступна как `DuoWide.isSupported()`.
- **Определение сложенного вида.** Safari на Duo всегда отдаёт в `screen` размер внешнего экрана, 466×678. Вид считается сложенным, если экран 466×678, а видимая область уже экрана на 1–84px. Тогда на `<html>` ставится `data-folded="right"` или `data-folded="left"` — по стороне панели.
- **Ширина страницы.** В meta viewport подменяются `width` (ширина экрана) и `height` (высота видимой области), остальные параметры берутся из разметки. Страница становится шириной во весь экран вместе с панелью, и фоны, `fixed`, `sticky` уходят под неё без дополнительных правил. В разложенном виде meta возвращается к исходному.
- **Прокрутка.** Прокручивается сам документ, строка адреса сворачивается как обычно. `touch-action: pan-y pinch-zoom` не даёт сдвинуть страницу вбок, `overscroll-behavior-y: none` убирает отскок, при котором уезжают `sticky`/`fixed`.
- **Панель слева.** В `landscape-primary` видимая область сдвигается на ширину панели, чтобы под панелью был край страницы. После зума сдвиг восстанавливается.

## Подключение

Подключите [`duo-wide.css`](duo-wide.css) и [`duo-wide.js`](duo-wide.js) в `<head>` после meta viewport:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover" />
<link rel="stylesheet" href="duo-wide.css" />
<script src="duo-wide.js"></script>
<script>
  new DuoWide().init();
</script>
```

- `minimum-scale=1` обязателен: иначе двойной тап уменьшает страницу и сбивает прокрутку.
- Скрипт синхронный, без `defer`/`async` и не `module`: meta и `data-folded` должны выставиться до первой отрисовки.

## API

```js
const duoWide = new DuoWide({
  panelWidth: 84, // максимальный зазор между экраном и видимой областью для сложенного вида
  barHeightMax: 120, // насколько максимум строка адреса сжимает видимую область
  screenShort: 466, // размер экрана Duo
  screenLong: 678,
}).init();

duoWide.destroy(); // снять обработчики, вернуть исходный meta viewport и убрать data-folded

DuoWide.isSupported(); // true только в Safari на iOS/iPadOS
```

- Все параметры необязательные, значения выше — по умолчанию (`DuoWide.defaults`).
- `panelWidth` влияет только на определение сложенного вида. CSS-переменная `--panel-width` задана в `duo-wide.css` отдельно — при другой ширине панели поменяйте и её.
- `init()` возвращает сам объект; повторный вызов ничего не делает. В неподдерживаемом браузере или без meta viewport `init()` тоже ничего не делает.

## Вёрстка под панель

Фоны уходят под панель сами. Чтобы текст оставался в видимой зоне, добавьте контейнерам отступ на ширину панели с её стороны (`--panel-width` из `duo-wide.css`):

```css
[data-folded="right"] .container {
  padding-right: calc(16px + var(--panel-width));
}

[data-folded="left"] .container {
  padding-left: calc(16px + var(--panel-width));
}
```

## Ограничения

- Размер экрана и ширина панели взяты из симулятора iPhone Duo (iOS 27.1). Если на устройстве они другие, сложенный режим просто не включится.
- Сторона панели определяется по `screen.orientation.type`: `landscape-primary` — слева, иначе справа. Само API документировано, а то, где Safari на Duo ставит панель в каждой ориентации, — наблюдение в симуляторе.
- Браузеры, которые полностью копируют user agent Safari (например, Brave), и встроенный Safari в приложениях проходят проверку как Safari.
- В сложенном виде медиазапросы по ширине видят ширину экрана (466 или 678), а не видимой области.
- В сложенном виде отключены отскок у краёв и pull-to-refresh, скрыт индикатор прокрутки.
- Высота страницы в одной ориентации только уменьшается, поэтому `fixed`-элементы у нижнего края при свёрнутой строке адреса стоят чуть выше края экрана.
