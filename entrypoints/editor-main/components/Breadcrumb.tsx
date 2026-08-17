interface BreadcrumbProps {
  element: Element;
  onSelect: (el: Element) => void;
}

export function getBreadcrumb(el: Element): Element[] {
  const chain: Element[] = [];
  let cur: Element | null = el;
  while (cur && cur.tagName !== 'HTML' && chain.length < 4) {
    chain.unshift(cur);
    cur = cur.parentElement;
  }
  const child = el.firstElementChild;
  return child ? [...chain, child] : chain;
}

export function Breadcrumb({ element, onSelect }: BreadcrumbProps) {
  return (
    <div className="twk-breadcrumb">
      {getBreadcrumb(element).map((el, i) => (
        <button
          key={i}
          type="button"
          className={el === element ? 'twk-crumb-active' : ''}
          onClick={() => onSelect(el)}
        >
          {el.tagName.toLowerCase()}
        </button>
      ))}
    </div>
  );
}
