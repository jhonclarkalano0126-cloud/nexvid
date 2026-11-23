
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
  'All',
  'Movies',
  'Music',
  'Gaming',
  'Sports',
  'News',
  'Technology',
  'Education',
  'Documentary',
  'Entertainment'
]

const categoryMap = {
  '1': 'Movies',
  '2': 'Entertainment',
  '10': 'Music',
  '15': 'Entertainment',
  '17': 'Sports',
  '18': 'Movies',
  '19': 'Entertainment',
  '20': 'Gaming',
  '22': 'Entertainment',
  '23': 'Entertainment',
  '24': 'Entertainment',
  '25': 'News',
  '26': 'Education',
  '27': 'Education',
  '28': 'Technology',
  '29': 'Documentary',
  '30': 'Movies',
  '35': 'Documentary'
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

  useEffect(() => {
    let cancelled = false

    async function fetchTrendingVideos() {
      setLoading(true)
      setError('')
      setYoutubeVideos([])

      try {
        const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY

        if (!apiKey) {
          throw new Error(
            'YouTube API key is missing. Please check your .env file.'
          )
        }

        const params = new URLSearchParams({
          part: 'snippet,statistics',
          chart: 'mostPopular',
          maxResults: '24',
          key: apiKey
        })

        if (region) {
          params.set('regionCode', region)
        }

        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(
            data.error?.message || 'Unable to load YouTube videos.'
          )
        }

        const results = (data.items || []).map(item => ({
          id: item.id,
          youtubeId: item.id,
          title: item.snippet.title,
          channel: item.snippet.channelTitle,
          category: categoryMap[item.snippet.categoryId] || 'Entertainment',
          image:
            item.snippet.thumbnails.high?.url ||
            item.snippet.thumbnails.medium?.url ||
            item.snippet.thumbnails.default?.url,
          views: item.statistics?.viewCount || '0'
        }))

        if (!cancelled) {
          setYoutubeVideos(results)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Something went wrong.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchTrendingVideos()

    return () => {
      cancelled = true
    }
  }, [region])

  const toggleFavorite = video => {
    setFavorites(current =>
      current.includes(video.id)
        ? current.filter(id => id !== video.id)
        : [...current, video.id]
    )
  }

  const filteredVideos = youtubeVideos.filter(video => {
    const matchesCategory =
      category === 'All' || video.category === category

    const matchesSearch = video.title
      .toLowerCase()
      .includes(search.toLowerCase())

    const matchesPage =
      page !== 'My List' || favorites.includes(video.id)

    return matchesCategory && matchesSearch && matchesPage
  })

  const openPage = nextPage => {
    setPage(nextPage)
    setCategory('All')
    setSearch('')
  }

  return (
    <div class="app">
      <header class="navbar">
        <button class="logo" onClick={() => openPage('Home')}>
          NEX<span>VID</span>
        </button>

        <nav class="nav-links">
          <button
            class={page === 'Home' ? 'nav-active' : ''}
            onClick={() => openPage('Home')}
          >
            Home
          </button>

          <button
            class={page === 'Trending' ? 'nav-active' : ''}
            onClick={() => openPage('Trending')}
          >
            Trending
          </button>

          <button
            class={page === 'My List' ? 'nav-active' : ''}
            onClick={() => openPage('My List')}
          >
            My List
          </button>
        </nav>
      </header>

      <section class="hero">
        <div class="hero-content">
          <p class="hero-label">YOUR VIDEO WORLD</p>
          <h1>One Place.<br /><span>Endless Videos.</span></h1>
          <p class="hero-description">
            Discover trending videos from around the world.
            Find what you love and watch in one place.
          </p>

          <button
            class="hero-button"
            onClick={() =>
              document.getElementById('videos')?.scrollIntoView({
                behavior: 'smooth'
              })
            }
          >
            Explore Videos
          </button>
        </div>
      </section>

      <main id="videos" class="main-content">
        <div class="section-top">
          <div>
            <p class="section-label">DISCOVER</p>
            <h2>
              {page === 'My List'
                ? 'My List'
                : page === 'Trending'
                  ? 'Trending Videos'
                  : 'Explore Videos'}
            </h2>
          </div>

          <div class="region-selector">
            <label for="region">Region</label>
            <select
              id="region"
              value={region}
              onChange={event => setRegion(event.currentTarget.value)}
            >
              {regions.map(item => (
                <option value={item.code}>{item.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div class="search-box">
          <span>⌕</span>
          <input
            type="search"
            placeholder="Search videos..."
            value={search}
            onInput={event => setSearch(event.currentTarget.value)}
          />
        </div>

        <div class="categories">
          {categories.map(item => (
            <button
              class={category === item ? 'category selected' : 'category'}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {loading && (
          <div class="status-message">
            <div class="loader"></div>
            <p>Loading trending videos...</p>
          </div>
        )}

        {!loading && error && (
          <div class="error-message">
            <h3>Unable to load videos</h3>
            <p>{error}</p>
            <button onClick={() => setRegion(current => current)}>
              Try Again
            </button>
            <p class="error-note">
              If this happens on the deployed website, check the
              YouTube API environment variable in Vercel.
            </p>
          </div>
        )}

        {!loading && !error && filteredVideos.length > 0 && (
          <div class="video-grid">
            {filteredVideos.map(video => (
              <article class="video-card" key={video.id}>
                <div
                  class="thumbnail"
                  style={{ backgroundImage: `url("${video.image}")` }}
                >
                  <button
                    class="play-icon"
                    aria-label={`Play ${video.title}`}
                    onClick={() => setSelectedVideo(video)}
                  >
                    ▶
                  </button>

                  <button
                    class={
                      favorites.includes(video.id)
                        ? 'heart favorited'
                        : 'heart'
                    }
                    aria-label="Add to My List"
                    onClick={() => toggleFavorite(video)}
                  >
                    ♥
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

        {!loading && !error && filteredVideos.length === 0 && (
          <div class="empty-message">
            <h3>No videos found</h3>
            <p>
              {page === 'My List'
                ? 'Add videos to My List by tapping the heart icon.'
                : 'Try another search or select a different category.'}
            </p>
          </div>
        )}
      </main>

      <footer class="footer">
        <h2>NEX<span>VID</span></h2>
        <p>Discover. Explore. Watch.</p>
        <small>
          Video content is provided by YouTube. NEXVID does not
          host or own the videos.
        </small>
      </footer>

      {selectedVideo && (
        <div
          class="player-overlay"
          onClick={event => {
            if (event.target === event.currentTarget) {
              setSelectedVideo(null)
            }
          }}
        >
          <div class="player-modal">
            <button
              class="close-player"
              onClick={() => setSelectedVideo(null)}
              aria-label="Close player"
            >
              ✕
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
