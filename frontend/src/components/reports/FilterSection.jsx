import { useState } from 'react';

const AGE_CATEGORIES = [
  { value: null, label: 'All Categories' },
  { value: 'U9', label: 'U9' },
  { value: 'U11', label: 'U11' },
  { value: 'U13', label: 'U13' },
  { value: 'U15', label: 'U15' },
  { value: 'U17', label: 'U17' },
  { value: 'U19', label: 'U19' },
  { value: 'Adults', label: 'Adults' },
  { value: 'Mixed', label: 'Mixed' },
];

export default function FilterSection({
  hideFreOnly,
  setHideFreOnly,
  ageCategory,
  setAgeCategory,
  onFilterChange,
  isMobile,
}) {
  const [expanded, setExpanded] = useState(!isMobile);

  const handleCheckbox = (e) => {
    setHideFreOnly(e.target.checked);
    onFilterChange();
  };

  const handleCategory = (e) => {
    setAgeCategory(e.target.value === 'null' ? null : e.target.value);
    onFilterChange();
  };

  if (isMobile) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between font-semibold text-gray-900"
        >
          <span>Filters</span>
          <span className="text-xl">{expanded ? '▼' : '▶'}</span>
        </button>

        {expanded && (
          <div className="mt-4 space-y-4 border-t border-gray-200 pt-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={hideFreOnly}
                onChange={handleCheckbox}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">Hide free-only students</span>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Age Category</label>
              <select
                value={ageCategory ?? 'null'}
                onChange={handleCategory}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                {AGE_CATEGORIES.map(cat => (
                  <option key={cat.value || 'all'} value={cat.value === null ? 'null' : cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="flex items-end gap-4">
      <label className="flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={hideFreOnly}
          onChange={handleCheckbox}
          className="w-4 h-4 rounded border-gray-300"
        />
        <span className="ml-2 text-sm text-gray-700">Hide free-only students</span>
      </label>

      <div className="flex items-end gap-2">
        <label className="block text-sm font-medium text-gray-700">Age Category</label>
        <select
          value={ageCategory ?? 'null'}
          onChange={handleCategory}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        >
          {AGE_CATEGORIES.map(cat => (
            <option key={cat.value || 'all'} value={cat.value === null ? 'null' : cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
