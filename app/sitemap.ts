// app/sitemap.ts
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://travisgilbert.me'
  
  // Your static routes
  const routes = ['', '/essays', '/field-notes', '/projects', '/now'].map(route => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: route === '' ? 'weekly' : 'monthly' as const,
    priority: route === '' ? 1 : 0.8,
  }))

  // Add your dynamic content pages here
  // const essays = getEssays().map(...)
  
  return routes
}
