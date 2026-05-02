export default function ViewToggle({ viewMode, setViewMode }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => setViewMode('summary')}
        className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm md:text-base ${
          viewMode === 'summary'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        Summary
      </button>
      <button
        onClick={() => setViewMode('detailed')}
        className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm md:text-base ${
          viewMode === 'detailed'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        Detailed
      </button>
    </div>
  );
}
