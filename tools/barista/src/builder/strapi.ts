/**
 * @license
 * Copyright 2019 Dynatrace LLC
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { join } from 'path';

import { fetchContentList } from '../utils/fetch-strapi-content';
import { slugify } from '../utils/slugify';
import { isPublicBuild } from '../utils/is-public-build';

import {
  markdownToHtmlTransformer,
  transformPage,
  headingIdTransformer,
} from '../transform';
import {
  BaPageBuilder,
  BaSinglePageMeta,
  BaPageTransformer,
  BaStrapiPage,
  BaStrapiContentType,
  BaLayoutType,
  BaPageBuildResult,
} from '@dynatrace/barista-components/barista-definitions';

const STRAPI_ENDPOINT = process.env.STRAPI_ENDPOINT;

const TRANSFORMERS: BaPageTransformer[] = [
  markdownToHtmlTransformer,
  headingIdTransformer,
];

/** Page-builder for Strapi CMS pages. */
export const strapiBuilder: BaPageBuilder = async (
  globalTransformers: BaPageTransformer[],
) => {
  // Return here if no endpoint is given.
  if (!STRAPI_ENDPOINT) {
    console.log('No Strapi endpoint given.');
    return [];
  }

  let pagesData = await fetchContentList<BaStrapiPage>(
    BaStrapiContentType.Pages,
    { publicContent: isPublicBuild() },
    STRAPI_ENDPOINT,
  );

  // Filter pages with draft set to null or false
  pagesData = pagesData.filter(page => !page.draft);

  const transformed: BaPageBuildResult[] = [];

  for (const page of pagesData) {
    const pageDir = page.category ? page.category.title.toLowerCase() : '/';
    const relativeOutFile = page.slug
      ? join(pageDir, `${page.slug}.json`)
      : join(pageDir, `${slugify(page.title)}.json`);
    const pageContent = await transformPage(
      {
        ...strapiMetaData(page),
        content: page.content,
      },
      [...TRANSFORMERS, ...globalTransformers],
    );
    transformed.push({ pageContent, relativeOutFile });
  }

  return transformed;
};

/**
 * Transform page metadata fetched from strapi
 * according to BaSinglePageMeta structure.
 */
function strapiMetaData(page: BaStrapiPage): BaSinglePageMeta {
  const metaData: BaSinglePageMeta = {
    title: page.title,
    layout: BaLayoutType.Default,
    category: page.category ? page.category.title : '',
  };

  // Set description
  if (page.description) {
    metaData.description = page.description;
  }

  // Set tags
  const tags = page.tags.map(tag => tag.name) || [];
  if (tags.length > 0) {
    metaData.tags = tags;
  }

  // Set UX Wiki page link (only for internal Barista)
  if (!isPublicBuild() && page.wiki) {
    metaData.wiki = page.wiki;
  }

  // Set contributors
  if (page.contributors && page.contributors.length > 0) {
    metaData.contributors = {};
    const uxSupport = page.contributors
      .filter(c => !c.developer)
      .map(c => ({
        name: c.name,
        gitHubUser: c.githubuser,
      }));
    const devSupport = page.contributors
      .filter(c => c.developer)
      .map(c => ({
        name: c.name,
        gitHubUser: c.githubuser,
      }));

    if (uxSupport.length > 0) {
      metaData.contributors!.ux = uxSupport;
    }

    if (devSupport.length > 0) {
      metaData.contributors!.dev = devSupport;
    }
  }

  if (page.toc) {
    metaData.toc = page.toc;
  }

  return metaData;
}
