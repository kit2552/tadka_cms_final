/**
 * Generate structured data (Schema.org) for articles
 * Includes FAQPage schema, Article schema, and E-E-A-T signals
 */

export const generateArticleSchema = (article) => {
  const schemas = [];

  // Base Article Schema with E-E-A-T signals
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": article.title,
    "description": article.aeo_description || article.seo_description || article.summary,
    "image": article.image,
    "datePublished": article.published_at,
    "dateModified": article.updated_at || article.published_at,
    "author": {
      "@type": "Person",
      "name": article.author,
      ...(article.author_credentials && {
        "jobTitle": article.author_credentials,
        "description": article.author_credentials
      })
    },
    "publisher": {
      "@type": "Organization",
      "name": "Tadka News",
      "logo": {
        "@type": "ImageObject",
        "url": "https://newsportal-upgrade.preview.emergentagent.com/logo.png"
      }
    },
    ...(article.fact_checked_by && {
      "reviewedBy": {
        "@type": "Person",
        "name": article.fact_checked_by
      }
    }),
    ...(article.last_reviewed_date && {
      "lastReviewed": article.last_reviewed_date
    })
  };

  // Add sources/citations if available
  if (article.sources) {
    try {
      const sourcesArray = article.sources.split(',').map(s => s.trim()).filter(s => s);
      if (sourcesArray.length > 0) {
        articleSchema.citation = sourcesArray;
      }
    } catch (e) {
      console.error('Error parsing sources:', e);
    }
  }

  schemas.push(articleSchema);

  // FAQPage Schema if FAQs exist
  if (article.faqs) {
    try {
      const faqsArray = typeof article.faqs === 'string' ? JSON.parse(article.faqs) : article.faqs;
      
      if (Array.isArray(faqsArray) && faqsArray.length > 0) {
        const faqSchema = {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": faqsArray
            .filter(faq => faq.question && faq.answer)
            .map(faq => ({
              "@type": "Question",
              "name": faq.question,
              "acceptedAnswer": {
                "@type": "Answer",
                "text": faq.answer
              }
            }))
        };

        if (faqSchema.mainEntity.length > 0) {
          schemas.push(faqSchema);
        }
      }
    } catch (e) {
      console.error('Error parsing FAQs:', e);
    }
  }

  // Movie Review specific schema
  if (article.content_type === 'movie_review' && article.movie_rating) {
    const reviewSchema = {
      "@context": "https://schema.org",
      "@type": "Review",
      "itemReviewed": {
        "@type": "Movie",
        "name": article.title,
        ...(article.review_director && { "director": article.review_director }),
        ...(article.review_cast && { "actor": article.review_cast.split(',').map(name => ({ "@type": "Person", "name": name.trim() })) })
      },
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": parseFloat(article.movie_rating),
        "bestRating": "5"
      },
      "author": {
        "@type": "Person",
        "name": article.author
      },
      "reviewBody": article.review_final_verdict || article.content
    };

    schemas.push(reviewSchema);
  }

  return schemas;
};

export const insertSchemaMarkup = (schemas) => {
  // Remove existing schema markup
  const existingScripts = document.querySelectorAll('script[type="application/ld+json"]');
  existingScripts.forEach(script => script.remove());

  // Insert new schema markup
  schemas.forEach(schema => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  });
};
