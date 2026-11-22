declare namespace foundry {
    namespace abstract { class Document {} }
    namespace documents {
        class Actor extends foundry.abstract.Document {}
        class ActiveEffect extends foundry.abstract.Document {}
        class AmbientLightDocument extends foundry.abstract.Document {}
        class ChatMessage extends foundry.abstract.Document {}
        class Folder extends foundry.abstract.Document {}
        class Item extends foundry.abstract.Document {}
        class Macro extends foundry.abstract.Document {}
        class RegionBehavior extends foundry.abstract.Document {}
        class RegionDocument extends foundry.abstract.Document {}
        class Scene extends foundry.abstract.Document {}
        class TokenDocument extends foundry.abstract.Document {}
        class User extends foundry.abstract.Document {}
        class WallDocument extends foundry.abstract.Document {}
        namespace collections { class CompendiumCollection {} }
    }
    namespace applications.api { class ApplicationV2 {} }
    namespace canvas {
        namespace geometry { class Ray {} }
        namespace placeables { class Token {} }
        namespace sources { class PointVisionSource {} }
    }
    namespace data.fields { class DataField {} }
    namespace dice { class Roll {} }
}
declare class Actor extends foundry.documents.Actor {}
declare class ActiveEffect extends foundry.documents.ActiveEffect {}
declare class ChatMessage extends foundry.documents.ChatMessage {}
declare class ClientDocument extends foundry.abstract.Document {}
declare class CompendiumCollection extends foundry.documents.collections.CompendiumCollection {}
declare class Folder extends foundry.documents.Folder {}
declare class Item extends foundry.documents.Item {}
declare class Macro extends foundry.documents.Macro {}
declare class PointVisionSource extends foundry.canvas.sources.PointVisionSource {}
declare class RegionBehavior extends foundry.documents.RegionBehavior {}
declare class Roll extends foundry.dice.Roll {}
declare class Scene extends foundry.documents.Scene {}
declare class Token extends foundry.canvas.placeables.Token {}
declare class TokenDocument extends foundry.documents.TokenDocument {}
declare class User extends foundry.documents.User {}
declare namespace dnd5e {
    namespace documents.activity { class Activity {} }
    namespace dataModels {
        namespace activity { class BaseActivityData {} }
        namespace fields { class FormulaField {} }
    }
    namespace dice {
        class D20Roll extends foundry.dice.Roll {}
        class DamageRoll extends foundry.dice.Roll {}
    }
}
declare class Activity extends dnd5e.documents.activity.Activity {}
declare class Actor5e extends foundry.documents.Actor {}
declare class Item5e extends foundry.documents.Item {}
declare class Token5e extends foundry.canvas.placeables.Token {}
declare namespace CONFIG.Dice { class DamageRoll extends dnd5e.dice.DamageRoll {} }
declare namespace MidiQOL {
    class Workflow {}
    class DamageOnlyWorkflow extends Workflow {}
}
declare namespace PIXI {
    class Graphics {}
    class Sprite {}
}
declare class Automation {}
declare class Summon {}
declare class DamageBonus {}
declare class D20Bonus {}
declare class Crosshairs {}
interface WallPath {}
interface HitData {}
interface EffectDurationData {}
