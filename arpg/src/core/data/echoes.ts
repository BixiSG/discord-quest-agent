// Echoes (round 5): what happened the day the sun fell, told by the people who
// were there. Eight come from map bosses; the four pinnacles each leave theirs
// on the first kill, with the piece of the sun they took (a sun shard).

export interface EchoDef {
    id: string;
    /** Who speaks. */
    who: string;
    text: string;
    /** Pinnacle whose first kill gives this echo (and its sun shard). */
    pinnacle?: string;
}

const list: EchoDef[] = [
    { id: "bell", who: "The bell keeper",
        text: "Every evening I rang the sun down, and every morning it came back up the hill. The last evening I rang and rang. The rope wore through my hands. I am still ringing. Someone has to be ready when it answers." },
    { id: "saltchild", who: "A child of Saltmire",
        text: "Mother said the tide gives back what it takes. It gave her back on the fourth day. She sat by the fire and didn't feel it. I stopped asking her to come to bed." },
    { id: "warden", who: "The Tide-Warden",
        text: "The order was to hold the gate until the light returned. Nobody said what to do if it didn't. So I held it. The sea was patient. So was I. Only one of us was dead." },
    { id: "lamplighter", who: "A lamplighter",
        text: "I lit the road from the shore to the chapel so the dead could find their way home. In the twelfth year the oil ran out. They still walk it in the dark. They know it by heart now." },
    { id: "sandwright", who: "The Sandwright",
        text: "Glass remembers light. I built towers to hold the last noon, mirror on mirror, so the Barrens would never be dark. They held it for a year. Then the light got bored of us and went looking for the sun." },
    { id: "regent", who: "The Glass Regent",
        text: "The Choir offered a bargain: a song that would keep the glass warm forever. The price was every voice in the Barrens but theirs. I thought it was a fair trade. I was the only one they let keep a mouth, so I could say yes." },
    { id: "judge", who: "The Ember Judge",
        text: "When the embers fell someone had to decide who deserved to wake. I weighed them: the brave, the kind, the useful. The embers did not care for my scales. They woke whoever they landed on. I have been judging the embers ever since." },
    { id: "matron", who: "The Cinder Matron",
        text: "My hounds were pups when the sun came down. They were cold, so I let them sleep in the crater. Now they are made of it. They still come when I whistle. They still bite what comes near the fire." },
    { id: "drownedsun", who: "The Drowned Sun", pinnacle: "drownedsun",
        text: "They could not bring the sun back, so the Warden's people made one. They sank the light of a thousand lamps into the sea and pulled up something round and bright and cold. It rose. It did not warm anything. It has been rising ever since, and I am what it rises through." },
    { id: "glasschoir", who: "The Glass Choir", pinnacle: "glasschoir",
        text: "We are the last noon, broken into a thousand pieces, each singing the note it heard as the sun fell. Together we are almost the sound of daylight. Almost. Every voice we take gets us closer." },
    { id: "ashenking", who: "The Ashen King", pinnacle: "ashenking",
        text: "I was crowned at the moment the sun hit the ground. I swore to rule until it rose again, and I have kept every oath I ever made. Do you understand what you are asking, Kindled? To end my reign you must keep my promise for me." },
    { id: "hollowcrown", who: "The Hollow Crown", pinnacle: "hollowcrown",
        text: "Before the March had kings it had me: a crown waiting for a head. The sun sat on my brow for a thousand years and I was full. Then I was hungry. I ate the light because it was there, as the tide takes the shore. You carry a spark of it in your chest. I can smell it." },
];

export const ECHOES: Record<string, EchoDef> = Object.fromEntries(list.map(e => [e.id, e]));
export const ECHO_ORDER = list.map(e => e.id);
/** Echoes map bosses can leave (the pinnacle ones come with their shard). */
export const MAP_ECHOES = list.filter(e => !e.pinnacle).map(e => e.id);
/** An atlas point for every this many echoes found. */
export const ECHOES_PER_POINT = 3;

/** What the hero hears when all three shards are held (the choice to relight the sun). */
export const SHARDS_TEXT = "Three pieces of the sun, still warm, and the ember in your chest beating in time with them. Put them together and the March might see a morning. The ember would have to go into the fire too.";
