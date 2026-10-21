// Typing style from a narration/menu class string: type-by-letter-{ms|slow|normal|fast|rapid},
// type-by-word-{…}, animation-resets-{ms}.
export interface TypingConfig { typeEachLetter: boolean; typeEachWord: boolean; typeElementMs: number, animationResets: number }

const NAMED_SPEEDS: Record<string, number> = {
  slow: 30,
  normal: 20,
  fast: 10,
  rapid: 5,
};

export function getConsequentalTypingConfig(className?: string): TypingConfig {
  if (!className) return { typeEachLetter: false, typeEachWord: false,  typeElementMs: 0, animationResets: 0  };
  const match = className.match(/\btype-by-letter-(\S+)/);
  const wordMatch= className.match(/\btype-by-word-(\S+)/);
  const resetsMatch = className.match(/\banimation-resets-(\S+)/);
  let resets = 0;
  if (resetsMatch) {
    resets = parseInt(resetsMatch[1], 10);
  }
 //console.log('class:' + className)
  if (!match && !wordMatch) return { typeEachLetter: false, typeEachWord: false, typeElementMs: 0, animationResets: 0 };

  const workingMatch = match ? match : wordMatch;
  if ( !workingMatch ) return { typeEachLetter: false, typeEachWord: false,  typeElementMs: 0, animationResets: resets  };
  const tEL = match !== null  ;
  const tEW = wordMatch !== null;
  const value = workingMatch[1];
  if (value in NAMED_SPEEDS) {
    return { typeEachLetter: tEL, typeEachWord: tEW, typeElementMs: NAMED_SPEEDS[value], animationResets: resets  };
  }

  const parsed = parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return { typeEachLetter: tEL, typeEachWord: tEW, typeElementMs: parsed, animationResets: resets  };
  }

  return { typeEachLetter: false, typeEachWord: false, typeElementMs: 0, animationResets: 0  };
}
