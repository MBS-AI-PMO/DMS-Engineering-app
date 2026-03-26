export const FILE_FORMATS = {
  step: {
    extension: 'step',
    label: 'STEP',
    kind: 'cad',
    supportsBackendUnfold: true,
    supportsBrowserCadParse: true,
  },
  stp: {
    extension: 'stp',
    label: 'STEP',
    kind: 'cad',
    supportsBackendUnfold: true,
    supportsBrowserCadParse: true,
  },
  iges: {
    extension: 'iges',
    label: 'IGES',
    kind: 'cad',
    supportsBackendUnfold: false,
    supportsBrowserCadParse: true,
  },
  igs: {
    extension: 'igs',
    label: 'IGES',
    kind: 'cad',
    supportsBackendUnfold: false,
    supportsBrowserCadParse: true,
  },
  dxf: {
    extension: 'dxf',
    label: 'DXF',
    kind: 'drawing',
    supportsBackendUnfold: false,
    supportsBrowserCadParse: false,
  },
  stl: {
    extension: 'stl',
    label: 'STL',
    kind: 'mesh',
    supportsBackendUnfold: false,
    supportsBrowserCadParse: false,
  },
  obj: {
    extension: 'obj',
    label: 'OBJ',
    kind: 'mesh',
    supportsBackendUnfold: false,
    supportsBrowserCadParse: false,
  },
  ply: {
    extension: 'ply',
    label: 'PLY',
    kind: 'mesh',
    supportsBackendUnfold: false,
    supportsBrowserCadParse: false,
  },
};

export const ACCEPTED_FILE_EXTENSIONS = Object.keys(FILE_FORMATS).map(
  (extension) => `.${extension}`
);

export function getFileExtension(fileName = '') {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts.at(-1) : '';
}

export function getFormatConfig(fileNameOrExtension = '') {
  const normalized = fileNameOrExtension.startsWith('.')
    ? fileNameOrExtension.slice(1).toLowerCase()
    : getFileExtension(fileNameOrExtension) || fileNameOrExtension.toLowerCase();

  return FILE_FORMATS[normalized] ?? null;
}

export function isSupportedFormat(fileNameOrExtension = '') {
  return Boolean(getFormatConfig(fileNameOrExtension));
}

export function getSupportedFormatLabels() {
  return ['.STEP', '.STP', '.IGES', '.IGS', '.DXF', '.STL', '.OBJ', '.PLY'];
}
