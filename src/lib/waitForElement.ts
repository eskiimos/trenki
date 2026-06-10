// Ждёт появления DOM-элемента по селектору. Нужен продуктовому туру:
// при переходе на другой маршрут (router.push) целевая страница
// перемонтируется и грузит данные асинхронно — элемент с data-tour
// появляется не сразу. Комбинируем мгновенную проверку + MutationObserver
// + polling (на случай, когда элемент меняет атрибуты, а не добавляется)
// + timeout, чтобы тур не завис навсегда.

export function waitForElement(
  selector: string,
  timeoutMs = 8000,
): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }

    const immediate = document.querySelector<HTMLElement>(selector);
    if (immediate) {
      resolve(immediate);
      return;
    }

    let done = false;
    const finish = (el: HTMLElement | null) => {
      if (done) return;
      done = true;
      observer.disconnect();
      clearInterval(interval);
      clearTimeout(timer);
      resolve(el);
    };

    const observer = new MutationObserver(() => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) finish(el);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Фолбэк-поллинг — ловит случаи, которые MutationObserver может
    // пропустить (например, элемент уже в DOM, но скрыт условием).
    const interval = setInterval(() => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) finish(el);
    }, 150);

    const timer = setTimeout(() => finish(null), timeoutMs);
  });
}
