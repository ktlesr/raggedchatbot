
export function normalizeTurkish(text: string): string {
    return text.toLocaleLowerCase('tr-TR').trim();
}
