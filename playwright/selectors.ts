/**
 * CDN Ops portal — https://cdnops.jingle.cn/upload/{OB}/ID/splash
 */
export const CDN_PORTAL_SELECTORS = {
  /** Logged-in indicator in sidebar */
  loggedInNav: 'Upload File',
  /** Login form (update if portal changes) */
  loginUsername:
    'input[type="text"], input[name="username"], input[placeholder*="user" i], input[placeholder*="account" i]',
  loginPassword: 'input[type="password"]',
  loginSubmit:
    'button[type="submit"], button:has-text("Login"), button:has-text("Log in"), button:has-text("Sign in")',
  /** Toolbar button (capital U) — opens the drop-zone modal */
  openUploadButton: 'button',
  openUploadButtonText: /^Upload$/,
  /** First modal */
  uploadModalTitle: 'Upload a file',
  dropZoneText: 'Drop or click to upload your files',
  fileInput: 'input[type="file"]',
  /** Second step after file pick */
  confirmPanelLabel: 'Security',
  confirmUploadButtonText: /^upload$/i,
  successToast: '.el-message--success, .ant-message-success, .upload-success',
} as const;
