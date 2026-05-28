import Module from 'module';

const originalRequire = Module.prototype.require;
(Module.prototype as any).require = function (request: string) {
  if (request.includes('schema.html')) {
    return '';
  }
  return originalRequire.apply(this, arguments as any);
};