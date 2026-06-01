import Module from 'module';

/**
 * 🛡️ TEMPORARY WORKAROUND: 
 * The 'graphql-gene' library contains an internal bug where it attempts to `require('./schema.html')`.
 * Since Node.js cannot resolve HTML files natively in a CommonJS context, this globally intercepts
 * that specific request and safe-returns an empty string to prevent application crashes.
 */
const originalRequire = Module.prototype.require;

(Module.prototype as any).require = function (request: string) {
  if (request.includes('schema.html')) {
    return '';
  }
  return originalRequire.apply(this, arguments as any);
};