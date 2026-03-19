// age_category is computed by the backend and returned with each student record.
// This file contains shared formatting helpers used across pages.

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-CA');
}
