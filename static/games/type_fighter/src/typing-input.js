export function inspectTypingInput(inputValue, acceptedValue, inputType = '') {
  if (
    inputType.startsWith('delete') &&
    acceptedValue.startsWith(inputValue) &&
    Array.from(acceptedValue.slice(inputValue.length)).length === 1
  ) {
    return { type: 'backspace', value: inputValue };
  }

  if (inputValue.startsWith(acceptedValue)) {
    const inserted = inputValue.slice(acceptedValue.length);
    if (Array.from(inserted).length === 1) {
      return { type: 'character', value: inserted };
    }
  }

  return { type: 'ignore', value: acceptedValue };
}

export function consumeParagraphCharacter(paragraph, index, character) {
  const expected = Array.from(paragraph)[index];
  if (expected === undefined || character !== expected) {
    return { accepted: false, expected, index };
  }

  const nextIndex = index + 1;
  return {
    accepted: true,
    expected,
    index: nextIndex,
    wordComplete: expected === ' ' || nextIndex === Array.from(paragraph).length,
    paragraphComplete: nextIndex === Array.from(paragraph).length,
  };
}

export function getParagraphWords(paragraph) {
  return Array.from(paragraph.matchAll(/\S+/g), (match) => ({
    text: match[0],
    start: match.index,
    end: match.index + match[0].length,
  }));
}

export function normalizeMistakeWord(word) {
  return word.replace(/[^\p{L}]/gu, '');
}
