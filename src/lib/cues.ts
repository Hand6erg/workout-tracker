/**
 * Korte teknik-tips til de indbyggede øvelser (#337).
 * Statisk data – gemmes ikke i brugerens state. Opsætning, bevægelse og en typisk fejl.
 */
export const BUILT_IN_CUES: Record<string, string[]> = {
  bench: ['Skulderblade samlet og nede', 'Stangen ned mod brystbenet', 'Fødderne plantet i gulvet', 'Undgå at albuerne flader helt ud'],
  'incline-db': ['Bænken i 30–45 grader', 'Håndvægtene ned ved øvre bryst', 'Pres op og let ind mod midten', 'Undgå at svaje i lænden'],
  dips: ['Skuldrene nede, væk fra ørerne', 'Let foroverlæn for mere bryst', 'Gå ned til ca. 90° i albuen', 'Undgå at falde for dybt ned'],
  'cable-fly': ['Let bøjede albuer hele vejen', 'Før hænderne sammen i en bue', 'Mærk strækket i brystet', 'Undgå at gøre det til et pres'],
  deadlift: ['Stangen tæt på skinnebenene', 'Ryggen neutral, brystet frem', 'Skub gulvet væk med benene', 'Undgå at runde lænden'],
  pullup: ['Start fra strakte arme', 'Træk albuerne ned mod lommerne', 'Hagen over stangen', 'Undgå at svinge med kroppen'],
  row: ['Hofteknæk, ryggen lige', 'Træk stangen mod navlen', 'Klem skulderbladene sammen', 'Undgå at rykke med overkroppen'],
  'lat-pulldown': ['Brystet op mod stangen', 'Træk stangen ned til øvre bryst', 'Albuerne ned og ind', 'Undgå at læne dig langt tilbage'],
  'face-pull': ['Rebet i øjenhøjde', 'Træk mod ansigtet, albuer højt', 'Drej hænderne udad til sidst', 'Undgå at bruge for meget vægt'],
  squat: ['Stangen hviler på øvre ryg', 'Knæene følger tæerne', 'Ned til hofterne er under knæene', 'Undgå at hælene letter'],
  rdl: ['Bløde knæ, hoften skubbes bagud', 'Stangen glider ned langs lårene', 'Mærk strækket bag i lårene', 'Undgå at runde ryggen'],
  'leg-press': ['Fødderne hoftebredt på pladen', 'Knæene følger tæerne', 'Lænden bliver mod ryglænet', 'Undgå at låse knæene helt'],
  lunge: ['Langt skridt frem', 'Bagerste knæ næsten ned i gulvet', 'Overkroppen oprejst', 'Undgå at knæet falder indad'],
  'leg-curl': ['Knæet ud for maskinens akse', 'Bøj rolig og helt op', 'Kontrolleret vej tilbage', 'Undgå at hoften letter'],
  'leg-ext': ['Knæet ud for maskinens akse', 'Stræk benene helt ud', 'Hold et øjeblik i toppen', 'Undgå at kaste vægten op'],
  calf: ['Fuldt stræk i bunden', 'Pres op på storetåen', 'Hold toppen et sekund', 'Undgå at vippe med knæene'],
  ohp: ['Stramme baller og mave', 'Pres stangen lige op', 'Hovedet frem under stangen', 'Undgå at svaje i lænden'],
  lateral: ['Let bøjede albuer', 'Løft ud til siden til skulderhøjde', 'Led med albuerne', 'Undgå at trække skuldrene op'],
  curl: ['Albuerne ind til siden', 'Krøl hele vejen op', 'Kontrolleret vej ned', 'Undgå at svinge med kroppen'],
  hammer: ['Tommelfingrene peger op', 'Albuerne ind til siden', 'Kontrolleret vej ned', 'Undgå at svinge med kroppen'],
  pushdown: ['Albuerne låst ind til siden', 'Stræk armene helt ned', 'Langsomt op igen', 'Undgå at læne dig over'],
  skullcrusher: ['Overarmene peger lodret op', 'Sænk stangen mod panden', 'Stræk kun i albuen', 'Undgå at albuerne spreder sig'],
  plank: ['Albuerne under skuldrene', 'Kroppen i en lige linje', 'Spænd mave og baller', 'Undgå at hoften hænger'],
  'dead-hang': ['Fuldt greb om stangen', 'Aktive skuldre, ikke slappe', 'Træk vejret roligt', 'Undgå at svinge'],
  'farmers-walk': ['Stå rank med skuldrene nede', 'Korte, hurtige skridt', 'Stramt greb hele vejen', 'Undgå at vægtene svinger'],
  rower: ['Ben, så krop, så arme', 'Ryggen lige hele vejen', 'Håndtaget ind mod nederste ribben', 'Undgå at trække med armene først'],
  crunch: ['Knæl foran kablet', 'Krum ryggen ned mod knæene', 'Hold hofterne stille', 'Undgå at trække med armene'],
};
