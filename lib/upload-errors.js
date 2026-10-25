// Map an /api/upload failure to a dictionary key + file name, so a
// posting/edit form can say what actually failed instead of a generic
// "something went wrong". The server's error strings are the contract:
// 'File too large', 'Unsupported file type',
// 'File content does not match its type', 'Too many attempts...', and
// 'Only activated landlord accounts can upload'.
export function uploadErrorInfo(res, errJson, fileName) {
  const reason = String(errJson?.error || '');
  if (res.status === 429 || /too many/i.test(reason)) return { key: 'uploadRateLimited', file: fileName };
  if (/too large/i.test(reason)) return { key: 'uploadTooLarge', file: fileName };
  if (/unsupported/i.test(reason)) return { key: 'uploadUnsupported', file: fileName };
  if (/does not match/i.test(reason)) return { key: 'uploadMismatch', file: fileName };
  if (/only activated/i.test(reason)) return { key: 'postNotActivated', file: fileName };
  return { key: 'uploadFailed', file: fileName };
}

export function uploadErrorMessage(t, info) {
  const template = t[info.key] || t.uploadFailed;
  return info.file ? template.replace('{file}', () => info.file) : template;
}
