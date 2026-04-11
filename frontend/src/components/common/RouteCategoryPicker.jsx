import React from 'react';
import { Search, Plus, X } from 'lucide-react';

const PAGE_SIZE = 18;

const parseCsv = (value) =>
  (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export default function RouteCategoryPicker({
  label = 'GeoSite Categories',
  value = '',
  onChange,
  options = [],
  optionLabels = {},
  placeholder = 'Search category...',
}) {
  const [query, setQuery] = React.useState('');
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const selected = React.useMemo(() => parseCsv(value), [value]);
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => {
      const lbl = optionLabels[item] || item;
      return item.toLowerCase().includes(q) || lbl.toLowerCase().includes(q);
    });
  }, [options, optionLabels, query]);

  const visible = React.useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleCount < filtered.length;

  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query]);

  const apply = (next) => onChange(next.join(', '));

  const addItem = (item) => {
    if (selectedSet.has(item)) return;
    apply([...selected, item]);
  };

  const removeItem = (item) => {
    apply(selected.filter((s) => s !== item));
  };

  const addCustom = () => {
    const custom = query.trim();
    if (!custom) return;
    addItem(custom);
    setQuery('');
  };

  const getDisplayLabel = (item) => optionLabels[item] || item;

  return (
    <div className="route-picker">
      <div className="route-picker-input-wrap">
        <Search size={16} className="route-picker-search-icon" />
        <input
          className="input-field route-picker-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
        />
        <button type="button" className="btn btn-secondary route-picker-add-btn" onClick={addCustom}>
          <Plus size={14} /> Add
        </button>
      </div>

      {selected.length > 0 && (
        <div className="route-picker-chips">
          {selected.map((item) => (
            <button
              key={item}
              type="button"
              className="route-chip selected"
              onClick={() => removeItem(item)}
              title="Remove"
            >
              <span>{getDisplayLabel(item)}</span>
              <X size={12} />
            </button>
          ))}
        </div>
      )}

      <div className="route-picker-list">
        {visible.map((item) => (
          <button
            key={item}
            type="button"
            className={`route-chip ${selectedSet.has(item) ? 'active' : ''}`}
            onClick={() => (selectedSet.has(item) ? removeItem(item) : addItem(item))}
            title={selectedSet.has(item) ? 'Selected (click to remove)' : 'Add'}
          >
            {getDisplayLabel(item)}
          </button>
        ))}
      </div>

      <div className="route-picker-footer">
        <span className="route-picker-meta">
          Showing {Math.min(visibleCount, filtered.length)} / {filtered.length} categories
        </span>
        {hasMore && (
          <button type="button" className="btn btn-secondary route-picker-more-btn" onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}>
            Show More
          </button>
        )}
      </div>
    </div>
  );
}
