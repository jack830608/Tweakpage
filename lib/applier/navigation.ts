export function watchUrlChanges(win: Window, onChange: (url: string) => void): void {
  let last = win.location.href;
  const check = () => {
    if (win.location.href !== last) {
      last = win.location.href;
      onChange(win.location.href);
    }
  };
  const nav = (win as Window & { navigation?: EventTarget }).navigation;
  nav?.addEventListener('currententrychange', check);
  win.addEventListener('popstate', check);
}
