import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement scrollIntoView; stub it so components that use it
// in click handlers don't throw under tests.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
