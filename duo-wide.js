/*
  DuoWide — растягивает страницу под боковую панель Safari на сложенном iPhone Duo.

  Подключение: в <head> после meta viewport, синхронным классическим скриптом.
    <link rel="stylesheet" href="duo-wide.css" />
    <script src="duo-wide.js"></script>
    <script>new DuoWide().init();</script>
*/
class DuoWide {
  static defaults = {
    panelWidth: 84,
    barHeightMax: 120,
    screenShort: 466,
    screenLong: 678,
  };

  static isSupported(userAgent = navigator.userAgent, maxTouchPoints = navigator.maxTouchPoints) {
    // iPadOS Safari представляется Mac-ом; другие браузеры на iOS добавляют в UA свою метку
    const isIOS =
      /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
    const isSafari =
      /Version\/[\d.]+.*Safari\//.test(userAgent) &&
      !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|YaBrowser|GSA\/|DuckDuckGo|Ddg\//.test(userAgent);

    return isIOS && isSafari && "visualViewport" in window && "orientation" in screen;
  }

  static #parseViewport(content) {
    return new Map(
      content
        .split(/[,;]/)
        .map((pair) => pair.split("=").map((part) => part.trim()))
        .filter(([key]) => key)
        .map(([key, value = ""]) => [key, value]),
    );
  }

  static #stringifyViewport(params) {
    return [...params].map(([key, value]) => (value === "" ? key : `${key}=${value}`)).join(", ");
  }

  #options;
  #root = document.documentElement;
  #viewport = document.querySelector('meta[name="viewport"]');
  #initialViewport = this.#viewport?.content ?? "";
  #viewportParams = DuoWide.#parseViewport(this.#initialViewport);
  #coarsePointer = matchMedia("(pointer: coarse)");
  #listeners = null;
  #layout = { width: 0, height: 0 };
  #side = null;
  #offsetX = 0;
  #offsetTimer = 0;

  constructor(options = {}) {
    this.#options = { ...DuoWide.defaults, ...options };
  }

  init() {
    if (this.#listeners || !this.#viewport || !DuoWide.isSupported()) return this;

    this.#listeners = new AbortController();
    const { signal } = this.#listeners;

    this.#update();
    screen.orientation.addEventListener("change", () => this.#update(), { signal });
    visualViewport.addEventListener(
      "resize",
      () => {
        this.#update();
        this.#scheduleOffsetRestore();
      },
      { signal },
    );
    visualViewport.addEventListener("scroll", () => this.#scheduleOffsetRestore(), { signal });

    return this;
  }

  destroy() {
    if (!this.#listeners) return;

    this.#listeners.abort();
    this.#listeners = null;
    clearTimeout(this.#offsetTimer);
    this.#viewport.content = this.#initialViewport;
    this.#applySide(null, 0);
  }

  #update() {
    const metrics = this.#measure();
    const side = this.#detectPanelSide(metrics);

    this.#updateLayoutSize(metrics);
    this.#applyViewport(side !== null);
    this.#applySide(side, metrics.gap);
    this.#restoreOffset();
  }

  #measure() {
    const { width, height, scale } = visualViewport;
    // ориентация по видимой области: посреди поворота screen.orientation уже новая, а размеры ещё старые
    const isLandscape = width > height;
    const screenShort = Math.min(screen.width, screen.height);
    const screenLong = Math.max(screen.width, screen.height);
    const screenWidth = isLandscape ? screenLong : screenShort;

    return {
      screenShort,
      screenLong,
      screenWidth,
      screenHeight: isLandscape ? screenShort : screenLong,
      visibleHeight: Math.round(height * scale),
      gap: screenWidth - Math.round(width * scale),
    };
  }

  // Safari на Duo всегда отдаёт в screen внешний экран; без проверки размера узкое окно на iPad тоже даёт зазор
  #detectPanelSide({ screenShort, screenLong, gap }) {
    const { panelWidth, screenShort: duoShort, screenLong: duoLong } = this.#options;
    const isDuoScreen = screenShort === duoShort && screenLong === duoLong;
    const isFolded = isDuoScreen && this.#coarsePointer.matches && gap > 0 && gap <= panelWidth;

    if (!isFolded) return null;

    return screen.orientation.type === "landscape-primary" ? "left" : "right";
  }

  // высота не больше видимой области, иначе у низа страницы fixed/sticky уезжают вверх;
  // клавиатура и pull-to-refresh сжимают видимую область сильнее строки адреса — такие замеры пропускаем
  #updateLayoutSize({ screenWidth, screenHeight, visibleHeight }) {
    if (screenWidth !== this.#layout.width) {
      this.#layout = { width: screenWidth, height: visibleHeight };
    } else if (visibleHeight > screenHeight - this.#options.barHeightMax) {
      this.#layout.height = Math.min(this.#layout.height, visibleHeight);
    }
  }

  // height обязателен: без него Safari растягивает высоту пропорционально ширине, и fixed/sticky съезжают
  #applyViewport(isFolded) {
    const params = new Map(this.#viewportParams);

    if (isFolded) {
      params.set("width", this.#layout.width);
      params.set("height", this.#layout.height);
    }

    const content = DuoWide.#stringifyViewport(params);

    if (this.#viewport.content !== content) this.#viewport.content = content;
  }

  #applySide(side, gap) {
    this.#side = side;
    this.#offsetX = side === "left" ? gap : 0;

    if (side) this.#root.setAttribute("data-folded", side);
    else this.#root.removeAttribute("data-folded");
  }

  // при панели слева видимая область сдвинута на её ширину; после зума Safari этот сдвиг сбрасывает
  #restoreOffset() {
    const isUnzoomed = Math.abs(visualViewport.scale - 1) < 0.01;

    if (this.#side && isUnzoomed && scrollX !== this.#offsetX) scrollTo(this.#offsetX, scrollY);
  }

  #scheduleOffsetRestore() {
    clearTimeout(this.#offsetTimer);
    this.#offsetTimer = setTimeout(() => this.#restoreOffset(), 100);
  }
}
