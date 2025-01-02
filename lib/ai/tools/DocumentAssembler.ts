interface MediaReference {
  type: 'image' | 'video';
  src: string;
  alt?: string;
}

interface BlogPostSection {
  heading: string;
  content: string;
}

export class DocumentAssembler {
  assembleBlogPost(outline: string, sections: BlogPostSection[], mediaReferences: MediaReference[]): string {
    console.log('Assembling blog post');
    let assembledPost = `${outline}\n\n`;

    sections.forEach(section => {
      assembledPost += `## ${section.heading}\n\n${section.content}\n\n`;
    });

    mediaReferences.forEach(media => {
      if (media.type === 'image') {
        assembledPost += `![${media.alt || 'Image'}](${media.src})\n\n`;
      } else if (media.type === 'video') {
        assembledPost += `<video src="${media.src}" controls></video>\n\n`;
      }
    });

    return assembledPost;
  }
}

