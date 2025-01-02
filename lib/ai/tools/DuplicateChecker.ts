export class DuplicateChecker {
  checkAndRemoveDuplicates(chunks: string[]): string[] {
    console.log('Checking and removing duplicates');
    const uniqueChunks = new Set(chunks);
    return Array.from(uniqueChunks);
  }
}

