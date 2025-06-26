/**
 * Capitalizes the first letter of a string.
 * @param str The string to capitalize.
 * @returns The string with its first letter capitalized, or an empty string if input is null/empty.
 */
export const capitalizeFirstLetter = (str: string | null | undefined): string => {
  if (!str) {
    return '';
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Checks if a string is empty, null, or undefined.
 * @param str The string to check.
 * @returns True if the string is empty, null, or undefined, false otherwise.
 */
export const isEmptyString = (str: string | null | undefined): boolean => {
  return !str || str.trim().length === 0;
};

/**
 * Truncates a string to a maximum length and appends an ellipsis if truncated.
 * @param str The string to truncate.
 * @param maxLength The maximum length of the string.
 * @param ellipsis The ellipsis string to append (defaults to '...').
 * @returns The truncated string.
 */
export const truncateString = (str: string | null | undefined, maxLength: number, ellipsis: string = '...'): string => {
  if (!str || str.length <= maxLength) {
    return str || '';
  }
  return str.substring(0, maxLength - ellipsis.length) + ellipsis;
};
