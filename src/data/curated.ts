export type TileAspect = 'landscape' | 'portrait'

export type CuratedSection = {
  title: string
  subreddits: string[]
  tileAspect?: TileAspect
}

export type LandscapeVideoShowcase = {
  title: string
  subtitle: string
  subreddit: string
}

export type TextSubredditSection = {
  title: string
  subreddits: string[]
  tileAspect?: TileAspect
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
    title: 'Popular Mix',
    subreddits: [
      'pics',
      'gifs',
      'interestingasfuck',
      'damnthatsinteresting',
      'nextfuckinglevel',
      'BeAmazed',
      'oddlysatisfying',
      'PublicFreakout',
    ],
    tileAspect: 'landscape',
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
    tileAspect: 'landscape',
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
    tileAspect: 'landscape',
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
    tileAspect: 'landscape',
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
    tileAspect: 'landscape',
  },
]

export const curatedNsfwSections: CuratedSection[] = [
  {
    title: 'Amateur Video',
    subreddits: [
      'GoneWildTube',
      'holdthemoan',
      'nsfw_videos',
      'soundonporn',
      'nsfwtalking',
      'porn_with_sounds',
    ],
    tileAspect: 'landscape',
  },
  {
    title: 'Quick Clips',
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
    tileAspect: 'landscape',
  },
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
    tileAspect: 'landscape',
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
    tileAspect: 'landscape',
  },
  {
    title: 'Women & Women',
    subreddits: ['lesbians', 'girlskissing', 'dykesgonewild'],
    tileAspect: 'landscape',
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
    tileAspect: 'landscape',
  },
  {
    title: 'Body Basics',
    subreddits: ['boobs', 'ass', 'pussy', 'milf', 'BigBoobsGW', 'Asstastic', 'thick'],
    tileAspect: 'landscape',
  },
]

export const curatedNsfwCinemaSources = [
  'GoneWildTube',
  'holdthemoan',
  'nsfw_videos',
  'soundonporn',
  'nsfwtalking',
  'porn_with_sounds',
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
    tileAspect: 'landscape',
  },
  {
    title: 'More Video',
    subreddits: [
      'NSFW_HTML5',
      'porn_with_sounds',
      'nsfw_videos',
      'soundonporn',
      'joivids',
      'long_porn',
      'GoneWildTube',
      'nsfwtalking',
    ],
    tileAspect: 'landscape',
  },
  {
    title: 'GIFs & Loops',
    subreddits: [
      'NSFW_GIF',
      'nsfw_gifs',
      'porn_gifs',
      'porninfifteenseconds',
      'WatchItForThePlot',
      '60fpsporn',
      'TittyDrop',
      'GirlsFinishingTheJob',
    ],
    tileAspect: 'landscape',
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
    tileAspect: 'landscape',
  },
  {
    title: 'Women & Women',
    subreddits: ['lesbians', 'girlskissing', 'dykesgonewild'],
    tileAspect: 'landscape',
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
    tileAspect: 'landscape',
  },
  {
    title: 'Body Basics',
    subreddits: ['boobs', 'ass', 'pussy', 'milf', 'Asstastic', 'BigBoobsGW'],
    tileAspect: 'landscape',
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
    tileAspect: 'landscape',
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
    title: 'Amateur tube',
    subtitle: 'Amateur-leaning video · /r/GoneWildTube',
    subreddit: 'GoneWildTube',
  },
  {
    title: 'Moan clips',
    subtitle: 'High-signal clip feed · /r/holdthemoan',
    subreddit: 'holdthemoan',
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
    title: 'Talking clips',
    subtitle: 'Audio-led videos · /r/nsfwtalking',
    subreddit: 'nsfwtalking',
  },
  {
    title: 'With sound',
    subtitle: 'Audio-heavy feed · /r/porn_with_sounds',
    subreddit: 'porn_with_sounds',
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
    title: 'On Off',
    subtitle: 'Mobile-style tease clips · /r/OnOff',
    subreddit: 'OnOff',
  },
  {
    title: 'Drop Clips',
    subtitle: 'Tall punchy clips · /r/TittyDrop',
    subreddit: 'TittyDrop',
  },
  {
    title: 'Fifteen seconds',
    subtitle: 'Fast vertical-feel clips · /r/porninfifteenseconds',
    subreddit: 'porninfifteenseconds',
  },
  {
    title: 'For the plot',
    subtitle: 'Short scroll feed · /r/WatchItForThePlot',
    subreddit: 'WatchItForThePlot',
  },
  {
    title: 'Finishers',
    subtitle: 'Quick mobile-style clips · /r/GirlsFinishingTheJob',
    subreddit: 'GirlsFinishingTheJob',
  },
  {
    title: 'GIF stream',
    subtitle: 'Tall-friendly GIF lane · /r/nsfw_gifs',
    subreddit: 'nsfw_gifs',
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
