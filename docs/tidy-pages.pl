undef $/;
my $text = <>;
# Join union types the plugin wraps across lines ("\<\n  \| A\n  \| B\>").
$text =~ s/\n  \\\| / \\| /g;
$text =~ s/\\< \\\| /\\</g;
$text =~ s/#### Returns\n \\\| /#### Returns\n\n/g;
# Returns with a description: one line.
$text =~ s/#### Returns\n\n([^\n]+)\n\n(?!#|```|\*\*\*|\|)([^\n]+)\n/**Returns:** $1. $2\n/g;
# Returns without a description.
$text =~ s/#### Returns\n\n([^\n]+)\n(\n|\z)(?=#|\*\*\*|\z)/**Returns:** $1\n$2/g;
# Link each heading to its source line instead of a "Defined in" line below it.
$text =~ s/^(#{2,6}) ([^\n]+)\n((?:(?!#{1,6} |Defined in: )[^\n]*\n)*?)Defined in: \[[^\]]*\]\(([^)]+)\)\n\n?/$1 [$2]($4)\n$3/gm;
$text =~ s/^Defined in: [^\n]*\n\n?//gm;
print $text;
