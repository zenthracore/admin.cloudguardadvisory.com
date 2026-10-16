import type { PermMode } from './access';

// Segmented control options, matching the mock's three states.
export const SEG_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ['none', 'Нет'],
  ['read', 'Чтение'],
  ['edit', 'Изменение'],
];

// Draft stores '' for "no access"; the segmented control uses none/read/edit.
export function modeToSeg(mode: PermMode | ''): string {
  return mode === 'read' ? 'read' : mode === 'write' ? 'edit' : 'none';
}

export function segToMode(seg: string): PermMode | '' {
  return seg === 'read' ? 'read' : seg === 'edit' ? 'write' : '';
}

export function AccessPermPool({
  label,
  pages,
  pageLabels,
  draft,
  on,
  onToggle,
  onPage,
}: {
  label: string;
  pages: string[];
  pageLabels: Record<string, string>;
  draft: Record<string, PermMode | ''>;
  on: boolean;
  onToggle: (on: boolean) => void;
  onPage: (page: string, mode: PermMode | '') => void;
}) {
  const count = pages.filter((page) => (draft[page] ?? '') !== '').length;
  return (
    <div className={'pool' + (on ? '' : ' off')}>
      <label className="ph">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => onToggle(e.target.checked)}
        />
        {label}
        <span className="cnt">
          {on ? `${count} из ${pages.length} разделов` : 'не выбран'}
        </span>
      </label>
      <div className="pm">
        {pages.map((page) => {
          const active = modeToSeg(draft[page] ?? '');
          return (
            <div className="pr" key={page}>
              <b>{pageLabels[page] || page}</b>
              <div className="seg" role="group" aria-label={pageLabels[page] || page}>
                {SEG_OPTIONS.map(([value, text]) => (
                  <button
                    key={value}
                    type="button"
                    data-v={value}
                    className={active === value ? 'on' : ''}
                    aria-pressed={active === value}
                    onClick={() => onPage(page, segToMode(value))}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
