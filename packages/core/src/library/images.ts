import mime from "mime";

export function isImageFile(name: string): boolean {
  return mime.getType(name)?.startsWith("image/") ?? false;
}

// Name without the last ".ext" (same as path.parse(name).name, but I/O-free;
// a leading dot is not an extension).
function baseName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

// Purely numeric names first (by value), then localeCompare.
export function compareImageNames(a: string, b: string): number {
  const nameA = baseName(a);
  const nameB = baseName(b);

  const numA = /^\d+$/.test(nameA) ? parseInt(nameA, 10) : Infinity;
  const numB = /^\d+$/.test(nameB) ? parseInt(nameB, 10) : Infinity;

  return numA - numB || nameA.localeCompare(nameB);
}

export function sortImageFiles(names: string[]): string[] {
  return names.filter(isImageFile).sort(compareImageNames);
}
