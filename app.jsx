import { useEffect, useState } from 'preact/hooks'
import './app.css'

const regions = [
  { name: 'Philippines', code: 'PH' },
  { name: 'Worldwide', code: '' },
  { name: 'United States', code: 'US' },
  { name: 'Japan', code: 'JP' },
  { name: 'South Korea', code: 'KR' },
  { name: 'Taiwan', code: 'TW' },
  { name: 'United Kingdom', code: 'GB' },
  { name: 'Canada', code: 'CA' },
  { name: 'Australia', code: 'AU' }
]

const categories = [
  'All', 'Movies', 'Music', 'Gaming', 'Sports', 'News', 'Technology',
  'Education', 'Documentary', 'Entertainment'
]

// YouTube category IDs (from videos.list -> snippet.categoryId).
// Documentary is not a dedicated YouTube category, so it is detected from metadata keywords.
const categoryMap = {
  '1': 'Movies',          // Film & Animation
  '10': 'Music',
  '17': 'Sports',
  '20': 'Gaming',
  '22': 'Entertainment',  // People & Blogs
  '23': 'Entertainment',  // Comedy
  '24': 'Entertainment',
  '25': 'News',           // News & Politics
  '26': 'Entertainment',  // Howto & Style
  '27': 'Education',
  '28': 'Technology'
}

const getVideoCategory = video => {
  const text = `${video.title || ''} ${video.description || ''} ${(video.tags || []).join(' ')}`.toLowerCase()
  const documentaryTerms = [
    'documentary', 'documentaries', 'docuseries', 'true story',
    'investigation', 'historical footage', 'wildlife', 'nature film'
  ]
  if (documentaryTerms.some(term => text.includes(term))) return 'Documentary'
  return categoryMap[video.categoryId] || 'Entertainment'
}

const REFRESH_INTERVAL = 30 * 60 * 1000

const decodeHtmlEntities = value => {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = value || ''
  return textarea.value
}

function App() {
  const [youtubeVideos, setYoutubeVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [favorites, setFavorites] = useState([])
  const [page, setPage] = useState('Home')
  const [region, setRegion] = useState('PH')
  const [selectedVideo, setSelectedVideo] = useState(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    let cancelled = false
    let refreshTimer
    let searchTimer

    async function getApiKey() {
      const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY
      if (!apiKey) {
        throw new Error('YouTube API key is missing. Please check your environment variable.')
      }
      return apiKey
    }

    async function addActualCategories(items, apiKey) {
      const validItems = items.filter(item => item.id?.videoId)
      const ids = validItems.map(item => item.id.videoId)
      if (ids.length === 0) return []

      // videos.list accepts at most 50 video IDs per request.
      const detailsById = new Map()
      for (let start = 0; start < ids.length; start += 50) {
        const batchIds = ids.slice(start, start + 50)
        try {
          const detailsParams = new URLSearchParams({
            part: 'snippet',
            id: batchIds.join(','),
            key: apiKey
          })
          const detailsResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?${detailsParams}`,
            { cache: 'no-store' }
          )
          if (detailsResponse.ok) {
            const detailsData = await detailsResponse.json()
            for (const item of detailsData.items || []) {
              detailsById.set(item.id, item.snippet || {})
            }
          } else {
            console.warn('YouTube category lookup failed; using fallback categories for this batch.')
          }
        } catch (detailsError) {
          console.warn('YouTube category lookup unavailable; using fallback categories for this batch.', detailsError)
        }
      }

      return validItems.map(item => {
        const videoId = item.id.videoId
        const snippet = item.snippet || {}
        const details = detailsById.get(videoId) || {}
        const category = getVideoCategory({
          categoryId: details.categoryId,
          title: snippet.title,
          description: details.description || snippet.description,
          tags: details.tags || []
        })

        return {
          id: videoId,
          youtubeId: videoId,
          title: decodeHtmlEntities(snippet.title),
          channel: decodeHtmlEntities(snippet.channelTitle),
          category,
          image: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url,
          views: '0'
        }
      })
    }

    async function fetchVideos(params) {
      params.set('maxResults', '50')
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?${params}`,
        { cache: 'no-store' }
      )
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error?.message || 'Unable to load YouTube videos.')
      }
      return data.items || []
    }

    async function fetchTrending() {
      setLoading(true)
      setError('')

      try {
        const apiKey = await getApiKey()
        // Ask YouTube for recently published videos so refresh can surface newer uploads.
        const params = new URLSearchParams({
          part: 'snippet',
          type: 'video',
          order: 'date',
          publishedAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          key: apiKey
        })
        if (region) params.set('regionCode', region)

        // One Search API request returns up to 50 videos, helping conserve daily quota.
        const items = await fetchVideos(params)
        const results = await addActualCategories(items, apiKey)

        if (!cancelled) {
          setYoutubeVideos(results)
          setLastUpdated(new Date())
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Something went wrong.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    async function fetchSearchResults(query) {
      setLoading(true)
      setError('')

      try {
        const apiKey = await getApiKey()
        const params = new URLSearchParams({
          part: 'snippet',
          type: 'video',
          q: query,
          order: 'relevance',
          safeSearch: 'moderate',
          key: apiKey
        })
        if (region) params.set('regionCode', region)

        const items = await fetchVideos(params)
        const results = await addActualCategories(items, apiKey)

        if (!cancelled) {
          setYoutubeVideos(results)
          setLastUpdated(new Date())
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Something went wrong.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const query = search.trim()
    if (query.length >= 2) {
      searchTimer = setTimeout(() => fetchSearchResults(query), 650)
    } else if (query.length === 0) {
      fetchTrending()
      refreshTimer = setInterval(fetchTrending, REFRESH_INTERVAL)
    } else {
      setLoading(false)
      setError('')
      if (query.length === 1) setYoutubeVideos([])
    }

    return () => {
      cancelled = true
      clearTimeout(searchTimer)
      clearInterval(refreshTimer)
    }
  }, [region, search, refreshToken])

  const toggleFavorite = video => {
    setFavorites(current =>
      current.includes(video.id)
        ? current.filter(id => id !== video.id)
        : [...current, video.id]
    )
  }

  const isSearching = search.trim().length >= 2
  const filteredVideos = youtubeVideos.filter(video => {
    const matchesCategory = isSearching || category === 'All' || video.category === category
    const matchesPage = page !== 'My List' || favorites.includes(video.id)
    return matchesCategory && matchesPage
  })

  const openPage = nextPage => {
    setPage(nextPage)
    setCategory('All')
    setSearch('')
  }

  const handleSearch = event => {
    setSearch(event.currentTarget.value)
    setCategory('All')
  }

  const handleRefresh = () => setRefreshToken(current => current + 1)

  return (
    <div class="app">
      <header class="navbar">
        <button class="logo" onClick={() => openPage('Home')}>NEX<span>VID</span></button>
        <nav class="nav-links">
          <button class={page === 'Home' ? 'nav-active' : ''} onClick={() => openPage('Home')}>Home</button>
          <button class={page === 'Trending' ? 'nav-active' : ''} onClick={() => openPage('Trending')}>Trending</button>
          <button class={page === 'My List' ? 'nav-active' : ''} onClick={() => openPage('My List')}>My List</button>
        </nav>
      </header>

      <section class="hero">
        <div class="hero-content">
          <p class="hero-label">YOUR VIDEO WORLD</p>
          <h1>One Place.<br /><span>Endless Videos.</span></h1>
          <p class="hero-description">Discover trending videos from around the world. Find what you love and watch in one place.</p>
          <button class="hero-button" onClick={() => document.getElementById('videos')?.scrollIntoView({ behavior: 'smooth' })}>Explore Videos</button>
        </div>
      </section>

      <main id="videos" class="main-content">
        <div class="section-top">
          <div>
            <p class="section-label">DISCOVER</p>
            <h2>{page === 'My List' ? 'My List' : page === 'Trending' ? 'Trending Videos' : isSearching ? 'Search Results' : 'Latest Videos'}</h2>
          </div>
          <div class="region-selector">
            <label for="region">Region</label>
            <select id="region" value={region} onChange={event => setRegion(event.currentTarget.value)}>
              {regions.map(item => <option value={item.code}>{item.name}</option>)}
            </select>
          </div>
        </div>

        <div class="search-box">
          <span class="search-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <circle cx="10.8" cy="10.8" r="6.8"></circle>
              <path d="m16 16 5 5"></path>
            </svg>
          </span>
          <input type="search" placeholder="Search any video on YouTube..." value={search} onInput={handleSearch} />
        </div>

        <div class="refresh-row">
          <p class="updated-label">
            {isSearching ? 'YouTube search results' : lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for videos...'}
          </p>
          {!isSearching && (
            <button class="refresh-button" onClick={handleRefresh} disabled={loading}>
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M20 7v5h-5"></path>
                <path d="M19 12a7.5 7.5 0 1 1-2-5.1L20 12"></path>
              </svg>
              {loading ? 'Refreshing...' : 'Refresh videos'}
            </button>
          )}
        </div>

        <div class="categories">
          {categories.map(item => (
            <button class={category === item ? 'category selected' : 'category'} onClick={() => setCategory(item)}>{item}</button>
          ))}
        </div>

        {search.trim().length === 1 && !loading && (
          <div class="empty-message"><h3>Keep typing</h3><p>Enter at least 2 characters to search YouTube.</p></div>
        )}

        {loading && (
          <div class="status-message"><div class="loader"></div><p>{isSearching ? 'Searching YouTube...' : 'Loading latest videos...'}</p></div>
        )}

        {!loading && error && (
          <div class="error-message">
            <h3>Unable to load videos</h3>
            <p>{error}</p>
            <button onClick={handleRefresh}>Try Again</button>
            <p class="error-note">If this happens on the deployed website, check the YouTube API environment variable and API restrictions in Google Cloud.</p>
          </div>
        )}

        {!loading && !error && filteredVideos.length > 0 && (
          <div class="video-grid">
            {filteredVideos.map(video => (
              <article class="video-card" key={video.id}>
                <div class="thumbnail" style={{ backgroundImage: `url("${video.image}")` }}>
                  <button class="play-icon" aria-label={`Play ${video.title}`} onClick={() => setSelectedVideo(video)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l10-6.5z"></path></svg>
                  </button>
                  <button class={favorites.includes(video.id) ? 'heart favorited' : 'heart'} aria-label={favorites.includes(video.id) ? 'Remove from My List' : 'Add to My List'} onClick={() => toggleFavorite(video)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.8 8.8c0 5.1-8.8 10-8.8 10s-8.8-4.9-8.8-10A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 8.8 2.4Z"></path></svg>
                  </button>
                </div>
                <div class="video-info">
                  <span class="video-category">{video.category}</span>
                  <h3>{video.title}</h3>
                  <p>{video.channel}</p>
                </div>
              </article>
            ))}
          </div>
        )}

        {!loading && !error && filteredVideos.length === 0 && search.trim().length !== 1 && (
          <div class="empty-message">
            <h3>No videos found</h3>
            <p>{page === 'My List' ? 'Add videos to My List by tapping the heart icon.' : isSearching ? 'Try different keywords.' : 'Try another search or select a different category.'}</p>
          </div>
        )}
      </main>

      <footer class="footer">
        <h2>NEX<span>VID</span></h2>
        <p>Discover. Explore. Watch.</p>
        <small>Video content is provided by YouTube. NEXVID does not host or own the videos.</small>
      </footer>

      {selectedVideo && (
        <div class="player-overlay" onClick={event => { if (event.target === event.currentTarget) setSelectedVideo(null) }}>
          <div class="player-modal">
            <button class="close-player" onClick={() => setSelectedVideo(null)} aria-label="Close player">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18"></path></svg>
            </button>
            <h2>{selectedVideo.title}</h2>
            <div class="player-frame">
              <iframe
                src={`https://www.youtube.com/embed/${selectedVideo.youtubeId}?autoplay=1&playsinline=1&rel=0`}
                title={selectedVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              ></iframe>
            </div>
            <p class="player-channel">{selectedVideo.channel}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
