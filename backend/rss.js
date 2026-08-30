import { create } from 'xmlbuilder2';

/**
 * Generates an iTunes-compliant RSS feed XML string for a podcast and its episodes.
 * 
 * @param {Object} podcast The podcast metadata object
 * @param {Array} episodes Array of episode objects
 * @param {string} hostUrl The current host URL (e.g., https://yourdomain.com) to build full URLs
 * @returns {string} XML string of the RSS feed
 */
export function generateRssFeed(podcast, episodes, hostUrl) {
  const feedUrl = `${hostUrl}/feeds/${podcast.feedSlug}`;
  
  // Format cover image URL to be absolute
  const coverUrl = podcast.coverUrl && (podcast.coverUrl.startsWith('http') 
    ? podcast.coverUrl 
    : `${hostUrl}${podcast.coverUrl}`);

  // Base channel info
  const channelObj = {
    title: podcast.title,
    description: podcast.description || '',
    link: podcast.websiteUrl || hostUrl,
    language: podcast.language || 'en-us',
    'itunes:author': podcast.author || '',
    'itunes:owner': {
      'itunes:name': podcast.author || '',
      'itunes:email': podcast.email || ''
    },
    'itunes:image': {
      '@href': coverUrl || ''
    },
    'itunes:category': {
      '@text': podcast.category || 'Society & Culture'
    },
    'itunes:explicit': podcast.explicit ? 'yes' : 'no',
    'itunes:type': 'episodic',
    generator: 'Podcastarama',
    lastBuildDate: new Date().toUTCString(),
    // RSS link tag pointing to the feed itself (recommended by standard)
    'atom:link': {
      '@href': feedUrl,
      '@rel': 'self',
      '@type': 'application/rss+xml'
    }
  };

  // Convert episodes to feed items
  const items = episodes
    .filter(ep => ep.status === 'published' && new Date(ep.publishDate) <= new Date())
    .map(ep => {
      const epAudioUrl = ep.audioUrl.startsWith('http') ? ep.audioUrl : `${hostUrl}${ep.audioUrl}`;
      const epDate = new Date(ep.publishDate).toUTCString();
      const epGuid = `${hostUrl}/episodes/${ep.id}`; // Stable guid

      const item = {
        title: ep.title,
        description: ep.description || '',
        'content:encoded': `<![CDATA[${ep.description || ''}]]>`,
        pubDate: epDate,
        guid: {
          '@isPermaLink': 'false',
          '#': epGuid
        },
        enclosure: {
          '@url': epAudioUrl,
          '@length': ep.audioSize || 0,
          '@type': 'audio/mpeg' // podcast players universally support audio/mpeg
        },
        'itunes:explicit': ep.explicit ? 'yes' : 'no',
        'itunes:episodeType': 'full'
      };

      if (ep.audioDuration) {
        item['itunes:duration'] = ep.audioDuration;
      }
      if (ep.episodeNumber !== null && ep.episodeNumber !== undefined) {
        item['itunes:episode'] = ep.episodeNumber;
      }
      if (ep.seasonNumber !== null && ep.seasonNumber !== undefined) {
        item['itunes:season'] = ep.seasonNumber;
      }

      return item;
    });

  // Construct complete feed structure
  const root = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('rss', {
      version: '2.0',
      'xmlns:itunes': 'http://www.itunes.com/dtds/podcast-1.0.dtd',
      'xmlns:content': 'http://purl.org/rss/1.0/modules/content/',
      'xmlns:atom': 'http://www.w3.org/2005/Atom'
    })
    .ele('channel');

  // Add channel nodes
  for (const [key, value] of Object.entries(channelObj)) {
    if (key === 'itunes:image') {
      root.ele('itunes:image', { href: value['@href'] });
    } else if (key === 'itunes:category') {
      root.ele('itunes:category', { text: value['@text'] });
    } else if (key === 'itunes:owner') {
      const owner = root.ele('itunes:owner');
      owner.ele('itunes:name').txt(value['itunes:name']);
      owner.ele('itunes:email').txt(value['itunes:email']);
    } else if (key === 'atom:link') {
      root.ele('atom:link', { href: value['@href'], rel: value['@rel'], type: value['@type'] });
    } else {
      root.ele(key).txt(value);
    }
  }

  // Add episode items
  for (const item of items) {
    const itemNode = root.ele('item');
    itemNode.ele('title').txt(item.title);
    itemNode.ele('description').txt(item.description);
    
    // Add raw content:encoded for Rich HTML support
    itemNode.ele('content:encoded').txt(item.description); // Simplified CDATA representation

    itemNode.ele('pubDate').txt(item.pubDate);
    itemNode.ele('guid', { isPermaLink: item.guid['@isPermaLink'] }).txt(item.guid['#']);
    itemNode.ele('enclosure', {
      url: item.enclosure['@url'],
      length: item.enclosure['@length'],
      type: item.enclosure['@type']
    });
    
    itemNode.ele('itunes:explicit').txt(item['itunes:explicit']);
    itemNode.ele('itunes:episodeType').txt(item['itunes:episodeType']);

    if (item['itunes:duration']) {
      itemNode.ele('itunes:duration').txt(item['itunes:duration']);
    }
    if (item['itunes:episode'] !== undefined) {
      itemNode.ele('itunes:episode').txt(item['itunes:episode']);
    }
    if (item['itunes:season'] !== undefined) {
      itemNode.ele('itunes:season').txt(item['itunes:season']);
    }
  }

  return root.end({ prettyPrint: true });
}
