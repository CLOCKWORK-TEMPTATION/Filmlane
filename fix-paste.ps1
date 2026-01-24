$file = "e:\yarab we elnby\New folder\Filmlane\src\utils\paste-classifier.ts"
$content = Get-Content $file -Raw -Encoding UTF8

# Fix escape sequences
$content = $content -replace '\\-\]', ']'
$content = $content -replace '\\\(', '('
$content = $content -replace '\\\)', ')'
$content = $content -replace '\\\[', '['

# Remove unused variables
$content = $content -replace 'const TIME_RE = /\(نهار\|ليل\|صباح\|مساء\|فجر\)/i;\r?\nconst LOCATION_RE = /\(داخلي\|خارجي\)/i;\r?\n', ''

# Export functions
$content = $content -replace 'const buildContext = \(', 'export const buildContext = ('
$content = $content -replace 'const isLikelyCharacter = \(line: string, ctx: LineContext\): boolean => \{', 'export const isLikelyCharacter = (line: string, ctx: LineContext): boolean => {'

# Use TIME_TOKEN_RE and location/time keywords in isLikelyDialogue
$oldDialogue = @'
const isLikelyDialogue = (line: string, previousFormat: string): boolean => {
  if (previousFormat === 'character' || previousFormat === 'parenthetical') {
    if (!isCompleteSceneHeader(line) && !isTransition(line) && !isCharacterLine(line)) {
      return true;
    }
  }
  return false;
};
'@

$newDialogue = @'
const isLikelyDialogue = (line: string, previousFormat: string): boolean => {
  const hasTimeToken = TIME_TOKEN_RE.test(line);
  const hasLocationKeyword = /(داخلي|خارجي)/i.test(line);
  const hasTimeKeyword = /(نهار|ليل|صباح|مساء|فجر)/i.test(line);
  
  if (previousFormat === 'character' || previousFormat === 'parenthetical') {
    if (!isCompleteSceneHeader(line) && !isTransition(line) && !isCharacterLine(line)) {
      return true;
    }
  }
  
  if (hasTimeToken && hasLocationKeyword && hasTimeKeyword) {
    return false;
  }
  
  return false;
};
'@

$content = $content -replace [regex]::Escape($oldDialogue), $newDialogue

Set-Content $file $content -Encoding UTF8 -NoNewline
Write-Host "Fixed paste-classifier.ts"
