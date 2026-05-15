export type CuratedSection = {
  title: string
  subreddits: string[]
}

export type LandscapeVideoShowcase = {
  title: string
  subtitle: string
  subreddit: string
}

export type TextSubredditSection = {
  title: string
  subreddits: string[]
}

export type HomepageCurationConfig = {
  nsfwLandscapeShowcase: LandscapeVideoShowcase[]
  nsfwMoreSections: TextSubredditSection[]
  nsfwPortraitShowcase: LandscapeVideoShowcase[]
  nsfwSections: CuratedSection[]
  sfwLandscapeShowcase: LandscapeVideoShowcase[]
  sfwPortraitShowcase: LandscapeVideoShowcase[]
  sfwSections: CuratedSection[]
}

export const curatedSfwSections: CuratedSection[] = [
  {
    title: 'Start Here',
    subreddits: [
      'pics',
      'gifs',
      'aww',
      'interestingasfuck',
      'damnthatsinteresting',
      'nextfuckinglevel',
      'BeAmazed',
      'oddlysatisfying',
    ],
  },
  {
    title: 'Scenery',
    subreddits: [
      'EarthPorn',
      'SpacePorn',
      'CityPorn',
      'SkyPorn',
      'VillagePorn',
      'WeatherPorn',
      'SeaPorn',
      'NatureIsFuckingLit',
    ],
  },
  {
    title: 'Spaces & Design',
    subreddits: [
      'ArchitecturePorn',
      'RoomPorn',
      'CozyPlaces',
      'DesignPorn',
      'AccidentalWesAnderson',
      'CabinPorn',
      'InfrastructurePorn',
      'Cityscapes',
    ],
  },
  {
    title: 'Photography & Art',
    subreddits: [
      'itookapicture',
      'analog',
      'ExposurePorn',
      'Art',
      'Illustration',
      'ImaginaryLandscapes',
      'ImaginaryCityscapes',
      'ImaginarySliceOfLife',
    ],
  },
  {
    title: 'Animals',
    subreddits: [
      'rarepuppers',
      'Eyebleach',
      'cats',
      'dogswithjobs',
      'AnimalsBeingDerps',
      'Awwducational',
      'WildlifePhotography',
      'AnimalPorn',
    ],
  },
  {
    title: 'Motion & Action',
    subreddits: [
      'videos',
      'reactiongifs',
      'PerfectLoops',
      'satisfyingasfuck',
      'maybemaybemaybe',
      'yesyesyesyesno',
      'woahdude',
      'PublicFreakout',
    ],
  },
]

export const curatedNsfwSections: CuratedSection[] = [
  {
    title: 'Real & Amateur',
    subreddits: [
      'gonewild',
      'RealGirls',
      'amateur',
      'altgonewild',
      'normalnudes',
      'PetiteGoneWild',
      'collegesluts',
      'gonewildcurvy',
      'AsiansGoneWild',
    ],
  },
  {
    title: 'Sound-On Video',
    subreddits: [
      'NSFW_HTML5',
      'porn_with_sounds',
      'nsfw_videos',
      'soundonporn',
      'joivids',
      'long_porn',
      'GoneWildTube',
      'nsfwtalking',
      'holdthemoan',
    ],
  },
  {
    title: 'GIFs & Quick Clips',
    subreddits: [
      'NSFW_GIF',
      'nsfw_gifs',
      'porn_gifs',
      'holdthemoan',
      'porninfifteenseconds',
      'OnOff',
      'TittyDrop',
      'GirlsFinishingTheJob',
      'WatchItForThePlot',
    ],
  },
  {
    title: 'Outdoor & Public',
    subreddits: [
      'gwpublic',
      'extramile',
      'HereInMyCar',
      'roadhead',
      'CarSexPorn',
      'PublicSexPorn',
      'RealPublicNudity',
      'FlashingGirls',
      'ChangingRooms',
    ],
  },
  {
    title: 'Women & Women',
    subreddits: [
      'lesbians',
      'girlskissing',
      'dykesgonewild',
    ],
  },
  {
    title: 'College & Petite',
    subreddits: [
      'petite',
      'PetiteGoneWild',
      'BustyPetite',
      'collegesluts',
      'smallboobs',
      'fitgirls',
    ],
  },
  {
    title: 'Body Basics',
    subreddits: [
      'boobs',
      'ass',
      'pussy',
      'milf',
      'BigBoobsGW',
      'Asstastic',
      'thick',
    ],
  },
]

export const curatedNsfwCinemaSources = [
  'NSFW_HTML5',
  'porn_with_sounds',
  'nsfw_videos',
  'long_porn',
  'joivids',
  'GoneWildTube',
  'soundonporn',
  'nsfwtalking',
  'holdthemoan',
]

export const curatedNsfwMoreSections: TextSubredditSection[] = [
  {
    title: 'Popular Galleries',
    subreddits: [
      'gonewild',
      'RealGirls',
      'amateur',
      'altgonewild',
      'normalnudes',
      'nsfw',
      'gonewild30plus',
      'gonewildcurvy',
      'GoneWildPlus',
      'AsiansGoneWild',
    ],
  },
  {
    title: 'Sound-On Video',
    subreddits: [
      'NSFW_HTML5',
      'porn_with_sounds',
      'nsfw_videos',
      'soundonporn',
      'joivids',
      'long_porn',
      'GoneWildTube',
      'nsfwtalking',
      'holdthemoan',
    ],
  },
  {
    title: 'GIFs & Quick Clips',
    subreddits: [
      'NSFW_GIF',
      'nsfw_gifs',
      'NSFW_HTML5',
      'porninfifteenseconds',
      'WatchItForThePlot',
      '60fpsporn',
      'porn_gifs',
      'TittyDrop',
      'GirlsFinishingTheJob',
    ],
  },
  {
    title: 'Public & Outdoor',
    subreddits: [
      'gwpublic',
      'extramile',
      'HereInMyCar',
      'roadhead',
      'CarSexPorn',
      'PublicSexPorn',
      'RealPublicNudity',
      'FlashingGirls',
    ],
  },
  {
    title: 'Women & Women',
    subreddits: [
      'lesbians',
      'girlskissing',
      'dykesgonewild',
    ],
  },
  {
    title: 'College & Petite',
    subreddits: [
      'petite',
      'PetiteGoneWild',
      'BustyPetite',
      'collegesluts',
      'smallboobs',
      'fitgirls',
    ],
  },
  {
    title: 'Body Basics',
    subreddits: [
      'boobs',
      'ass',
      'pussy',
      'milf',
      'Asstastic',
      'BigBoobsGW',
    ],
  },
  {
    title: 'RealGirls & Regional',
    subreddits: [
      'RealGirls',
      'AsiansGoneWild',
      'russiangirls',
      'gonewild30plus',
      'gonewildcurvy',
    ],
  },
]

export const landscapeVideoShowcase: LandscapeVideoShowcase[] = [
  {
    title: 'Wide clips',
    subtitle: 'General Reddit video · /r/videos',
    subreddit: 'videos',
  },
  {
    title: 'Food & mealtime',
    subtitle: 'Cooking and plating · /r/mealtimevideos',
    subreddit: 'mealtimevideos',
  },
  {
    title: 'Artisan craft',
    subtitle: 'Making things by hand · /r/artisanvideos',
    subreddit: 'artisanvideos',
  },
  {
    title: 'Politics & news',
    subtitle: 'Speeches and clips · /r/politicalvideo',
    subreddit: 'politicalvideo',
  },
  {
    title: 'Deep YouTube',
    subtitle: 'Longform docs · /r/Documentaries',
    subreddit: 'Documentaries',
  },
  {
    title: 'Trailers',
    subtitle: 'Movie and TV previews · /r/Trailers',
    subreddit: 'Trailers',
  },
]

export const nsfwLandscapeVideoShowcase: LandscapeVideoShowcase[] = [
  {
    title: 'Sound-on clips',
    subtitle: 'Landscape audio feed · /r/porn_with_sounds',
    subreddit: 'porn_with_sounds',
  },
  {
    title: 'HTML5 Cinema',
    subtitle: 'Wide adult video · /r/NSFW_HTML5',
    subreddit: 'NSFW_HTML5',
  },
  {
    title: 'NSFW videos',
    subtitle: 'General adult video · /r/nsfw_videos',
    subreddit: 'nsfw_videos',
  },
  {
    title: 'Sound on',
    subtitle: 'Audio-first clips · /r/soundonporn',
    subreddit: 'soundonporn',
  },
  {
    title: 'JOI videos',
    subtitle: 'Filtered to wide clips · /r/joivids',
    subreddit: 'joivids',
  },
  {
    title: 'Longer clips',
    subtitle: 'Landscape long-form · /r/long_porn',
    subreddit: 'long_porn',
  },
  {
    title: 'Tube clips',
    subtitle: 'Sound-on video · /r/GoneWildTube',
    subreddit: 'GoneWildTube',
  },
  {
    title: 'Talking clips',
    subtitle: 'Audio-led videos · /r/nsfwtalking',
    subreddit: 'nsfwtalking',
  },
  {
    title: 'Moan clips',
    subtitle: 'Filtered to landscape · /r/holdthemoan',
    subreddit: 'holdthemoan',
  },
]

export const portraitVideoShowcase: LandscapeVideoShowcase[] = [
  {
    title: 'YouTube Haiku',
    subtitle: 'Short vertical edits · /r/youtubehaiku',
    subreddit: 'youtubehaiku',
  },
  {
    title: 'TikTok Cringe',
    subtitle: 'Mobile-first clips · /r/tiktokcringe',
    subreddit: 'tiktokcringe',
  },
  {
    title: 'Vertical Video',
    subtitle: 'Tall-format feed · /r/verticalvideo',
    subreddit: 'verticalvideo',
  },
  {
    title: 'Vertical Videos',
    subtitle: 'Full-screen mobile videos · /r/verticalvideos',
    subreddit: 'verticalvideos',
  },
  {
    title: 'Perfectly Cut',
    subtitle: 'Fast punchline clips · /r/PerfectlyCutScreams',
    subreddit: 'PerfectlyCutScreams',
  },
  {
    title: 'Shortform',
    subtitle: 'Quick scroll feed · /r/shortform',
    subreddit: 'shortform',
  },
]

export const nsfwPortraitVideoShowcase: LandscapeVideoShowcase[] = [
  {
    title: 'NSFW GIF',
    subtitle: 'Fast silent loops · /r/NSFW_GIF',
    subreddit: 'NSFW_GIF',
  },
  {
    title: 'GIF stream',
    subtitle: 'Portrait-ready clips · /r/nsfw_gifs',
    subreddit: 'nsfw_gifs',
  },
  {
    title: 'Hold the Moan',
    subtitle: 'Quick high-quality clips · /r/holdthemoan',
    subreddit: 'holdthemoan',
  },
  {
    title: 'On Off',
    subtitle: 'Mobile-style tease clips · /r/OnOff',
    subreddit: 'OnOff',
  },
  {
    title: 'Drop Clips',
    subtitle: 'Portrait-heavy clips · /r/TittyDrop',
    subreddit: 'TittyDrop',
  },
  {
    title: 'Short loops',
    subtitle: 'No-sound quality lane · /r/porn_gifs',
    subreddit: 'porn_gifs',
  },
]

function flattenSections(sections: Array<{ subreddits: string[] }>) {
  const seen = new Set<string>()

  return sections.flatMap((section) =>
    section.subreddits.filter((subreddit) => {
      const key = subreddit.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }),
  )
}

export const curatedSfw = flattenSections(curatedSfwSections)
export const curatedNsfw = flattenSections([
  ...curatedNsfwSections,
  ...curatedNsfwMoreSections,
])

export const defaultHomepageCurationConfig: HomepageCurationConfig = {
  nsfwLandscapeShowcase: nsfwLandscapeVideoShowcase,
  nsfwMoreSections: curatedNsfwMoreSections,
  nsfwPortraitShowcase: nsfwPortraitVideoShowcase,
  nsfwSections: curatedNsfwSections,
  sfwLandscapeShowcase: landscapeVideoShowcase,
  sfwPortraitShowcase: portraitVideoShowcase,
  sfwSections: curatedSfwSections,
}
