# Character Generation

## Overview

RPGate automatically generates random ability scores for new characters using D&D-style dice rolling mechanics. The system intelligently assigns higher scores to abilities that are most important for the character's class.

## Ability Score Generation

### Method: 4d6 Drop Lowest

For each ability score:
1. Roll 4 six-sided dice (4d6)
2. Drop the lowest roll
3. Sum the remaining 3 dice

This produces scores in the range of **3-18**, with an average around **12-13**.

**Example:**
- Rolls: 5, 3, 6, 4
- Drop lowest: ~~3~~
- Sum: 5 + 6 + 4 = **15**

### Ability Modifiers

Scores are converted to modifiers using the D&D 5e formula:

```
modifier = floor((score - 10) / 2)
```

| Score | Modifier |
|-------|----------|
| 3     | -4       |
| 8-9   | -1       |
| 10-11 | +0       |
| 12-13 | +1       |
| 14-15 | +2       |
| 16-17 | +3       |
| 18-19 | +4       |
| 20    | +5       |

## Class-Based Optimization

The system assigns the highest rolled scores to abilities that are most important for the character's class.

### Class Priority Tables

#### Strength-Based Classes
**Classes:** Воин, Warrior, Fighter, Барбар, Barbarian

**Priority:** STR → CON → DEX → WIS → CHA → INT

Best for melee combat and physical prowess.

#### Dexterity-Based Classes
**Classes:** Вор, Rogue, Плут, Разбойник

**Priority:** DEX → CON → INT → CHA → WIS → STR

Best for stealth, agility, and finesse.

#### Intelligence-Based Classes
**Classes:** Маг, Wizard, Волшебник, Чародей, Sorcerer

**Priority:** INT → CON → DEX → WIS → CHA → STR

Best for arcane magic and knowledge.

#### Wisdom-Based Classes
**Classes:** Жрец, Cleric, Друид, Druid, Монах, Monk

**Priority:** WIS → CON → DEX → STR → CHA → INT

Best for divine magic and perception.

#### Charisma-Based Classes
**Classes:** Бард, Bard, Паладин, Paladin

**Priority:** CHA → CON → STR → DEX → WIS → INT

Best for social interaction and divine/arcane magic.

#### Hybrid Classes
**Classes:** Рейнджер, Ranger, Следопыт

**Priority:** DEX → WIS → CON → STR → INT → CHA

Balanced for ranged combat and nature magic.

### Unknown Classes

If the class name doesn't match any known pattern, the system uses a balanced distribution: STR → DEX → CON → INT → WIS → CHA.

## Implementation

### Core Functions

```typescript
// Generate random ability scores
const { scores, modifiers } = generateAbilityScores();

// Generate optimized scores for a class
const { scores, modifiers } = generateAbilityScoresForClass("Воин");
```

### Character Creation Flow

1. **User creates character** with class name and bio
2. **System generates scores** using `generateAbilityScoresForClass(className)`
3. **Modifiers are calculated** from scores
4. **Character is saved** to database with modifiers
5. **Modifiers are used** in skill checks and combat

### Database Storage

Only **modifiers** are stored in the database, not raw scores:

```typescript
{
  strMod: 2,   // +2 modifier (score was 14-15)
  dexMod: 1,   // +1 modifier (score was 12-13)
  conMod: 1,   // +1 modifier (score was 12-13)
  intMod: 0,   // +0 modifier (score was 10-11)
  wisMod: 0,   // +0 modifier (score was 10-11)
  chaMod: -1   // -1 modifier (score was 8-9)
}
```

This simplifies calculations and reduces storage requirements.

## Example Generation

### Warrior Character

```typescript
const warrior = generateAbilityScoresForClass("Воин");
// Possible result:
{
  scores: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 9 },
  modifiers: { str: +3, dex: +1, con: +2, int: -1, wis: 0, cha: -1 }
}
```

**Analysis:**
- High STR (+3) for melee attacks
- Good CON (+2) for hit points
- Decent DEX (+1) for armor class
- Low INT (-1) but not critical for warrior

### Wizard Character

```typescript
const wizard = generateAbilityScoresForClass("Маг");
// Possible result:
{
  scores: { str: 8, dex: 13, con: 14, int: 17, wis: 11, cha: 10 },
  modifiers: { str: -1, dex: +1, con: +2, int: +3, wis: 0, cha: 0 }
}
```

**Analysis:**
- High INT (+3) for spell power
- Good CON (+2) for survivability
- Decent DEX (+1) for armor class
- Low STR (-1) but wizards don't need it

## Testing

The system includes comprehensive tests:

```bash
pnpm test lib/mechanics/ability-scores.test.ts
```

**Test Coverage:**
- ✅ 4d6 drop lowest produces valid range (3-18)
- ✅ Score to modifier conversion
- ✅ Full ability score generation
- ✅ Class-based optimization
- ✅ Randomness verification
- ✅ Unknown class handling

## Future Enhancements

Potential improvements for post-MVP:

- [ ] **Point Buy System** - Alternative to random rolls
- [ ] **Standard Array** - Fixed scores (15, 14, 13, 12, 10, 8)
- [ ] **Racial Bonuses** - +2/+1 to specific abilities
- [ ] **Manual Assignment** - Let players arrange rolled scores
- [ ] **Reroll Option** - Allow one reroll if scores are too low
- [ ] **Score Display** - Show raw scores in character sheet
- [ ] **Ability Score Increases** - Level-up improvements

## API Usage

### Creating Character with Random Scores

```bash
# POST /api/character
curl -X POST http://localhost:3000/api/character \
  -H 'Content-Type: application/json' \
  -d '{
    "className": "Воин",
    "bio": "Храбрый воин из северных земель"
  }'

# Response includes generated modifiers:
{
  "character": {
    "id": 1,
    "className": "Воин",
    "bio": "Храбрый воин из северных земель",
    "strMod": 3,
    "dexMod": 1,
    "conMod": 2,
    "intMod": -1,
    "wisMod": 0,
    "chaMod": -1
  }
}
```

### Viewing Character Stats

```bash
# GET /api/character
curl http://localhost:3000/api/character

# Response shows current modifiers
{
  "character": {
    "strMod": 3,
    "dexMod": 1,
    ...
  }
}
```

## Design Decisions

### Why Store Only Modifiers?

1. **Simplicity** - Modifiers are what actually matter in gameplay
2. **Performance** - No conversion needed during skill checks
3. **Storage** - Smaller database footprint
4. **Flexibility** - Easier to adjust modifiers directly if needed

### Why Class-Based Optimization?

1. **Better Experience** - Characters are viable in their role
2. **Reduces Frustration** - No "bad rolls" that make character unplayable
3. **Maintains Randomness** - Still unpredictable, just optimized
4. **D&D Tradition** - Many DMs allow score arrangement

### Why 4d6 Drop Lowest?

1. **Standard Method** - Most popular in D&D 5e
2. **Higher Average** - More heroic characters (avg ~12-13 vs 10.5 for 3d6)
3. **Reduces Extremes** - Fewer very low scores
4. **Exciting** - Rolling dice is fun!
