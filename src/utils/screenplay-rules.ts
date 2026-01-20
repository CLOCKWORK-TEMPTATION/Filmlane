/**
 * Screenplay formatting rules
 * Defines the business logic for screenplay element transitions
 */

/**
 * Determines the next format when Tab key is pressed
 * @param currentFormat - The current format type (e.g., 'action', 'character', 'dialogue')
 * @param isEmpty - Whether the current element is empty
 * @param shiftPressed - Whether Shift key is held (for reverse navigation)
 * @returns The next format type
 */
export const getNextFormatOnTab = (
    currentFormat: string,
    isEmpty = false,
    shiftPressed = false
): string => {
    const mainSequence = ['scene-header-1', 'action', 'character', 'transition'];
    if (currentFormat === 'character' && isEmpty) return shiftPressed ? 'action' : 'transition';
    if (currentFormat === 'dialogue') return shiftPressed ? 'character' : 'parenthetical';
    if (currentFormat === 'parenthetical') return shiftPressed ? 'dialogue' : 'dialogue';

    const currentIndex = mainSequence.indexOf(currentFormat);
    if (currentIndex !== -1) {
        if (shiftPressed) return mainSequence[(currentIndex - 1 + mainSequence.length) % mainSequence.length];
        else return mainSequence[(currentIndex + 1) % mainSequence.length];
    }
    return currentFormat;
};

/**
 * Determines the next format when Enter key is pressed
 * @param currentFormat - The current format type
 * @returns The next format type after pressing Enter
 */
export const getNextFormatOnEnter = (currentFormat: string): string => {
    const transitions: { [key: string]: string } = {
        'basmala': 'scene-header-1',
        'scene-header-top-line': 'action',
        'scene-header-1': 'action',
        'scene-header-2': 'action',
        'scene-header-3': 'action',
        'action': 'action',
        'character': 'dialogue',
        'parenthetical': 'dialogue',
        'dialogue': 'character',
        'transition': 'scene-header-1'
    };
    return transitions[currentFormat] || 'action';
};
