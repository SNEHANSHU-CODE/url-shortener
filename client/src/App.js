import React, { useEffect, useState } from 'react'
import './App.css'
import ImgCopy from './copy.png'
import axios from 'axios'
function App() {

  const [url, setUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [links, setLinks] = useState([]);

  const generateLink = async () => {
    const response = await axios.post('https://url-server.onrender.com/link', {
      url,
      slug
    })
    setShortUrl(response?.data?.data.shortUrl)

  }
  const copyShortUrl = () => {

    navigator.clipboard.writeText(shortUrl)
    alert('copy to clipboard')
  }
  const loadLinks = async () => {
    const response = await axios.get('https://url-server.onrender.com/api/links');
    setLinks(response?.data?.data)
  }
  useEffect(() => {
      loadLinks();
    }, [])
  return (
    <div>
      <h1 className='app-title'>Url Shortener</h1>
      <div className='app-container'>
        <div className='link-generation-card'>
          <h2>Link Generation</h2>
          <input type='text'
            placeholder='URL'
            className='user-input'
            value={url}
            onChange={(e) => { setUrl(e.target.value) }} />

          <input type='text'
            placeholder='Slug (optional)'
            className='user-input'
            value={slug}
            onChange={(e) => { setSlug(e.target.value) }} />
          <div className='short-url-container'>
            <input type='text'
              placeholder='Short URL'
              className='input-short-url'
              value={`https://url-shortener-0f3m.onrender.com/${shortUrl}`}
              disabled />
            <img src={ImgCopy} alt='copy' className='copy-icon' onClick={copyShortUrl} />
          </div>
          <button type='button' className='btn-generate-link' onClick={generateLink}>
            Generate
          </button>
        </div>
        <div className='all-links-container'>
        
          {
            links?.map((linkObj, index) => {
         const  {url, slug, clicks}= linkObj;

          return (
          <div className='link-card' >
            <p>URL:{url}</p>
            <p>Short URL: {process.env.REACT_APP_BASE_URI}/{slug}</p>
            <p>Clicks:{clicks}</p>

          </div>
          )
        })
      }
        </div>
      </div>
    </div>
  )
}

export default App;
