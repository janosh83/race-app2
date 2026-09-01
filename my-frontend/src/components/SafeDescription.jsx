import DOMPurify from 'dompurify';

const sanitizationConfig = {
  ALLOWED_TAGS: ['a', 'b', 'br', 'em', 'i', 'li', 'ol', 'p', 'strong', 'u', 'ul'],
  ALLOWED_ATTR: ['href'],
};

function SafeDescription({ html, className }) {
  const sanitizedHtml = DOMPurify.sanitize(html, sanitizationConfig);

  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
}

export default SafeDescription;