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
import {
  promises as fs,
  readFileSync,
  readdirSync,
  lstatSync,
  existsSync,
} from 'fs';

import {
  BaCategoryNavigation,
  BaCategoryNavigationSectionItem,
  BaSinglePageMeta,
  BaNav,
  BaNavItem,
} from '@dynatrace/barista-components/barista-definitions';

const DIST_DIR = join(
  __dirname,
  '../../../',
  'dist',
  'apps',
  'barista',
  'data',
);

// for now we manually select highlighted items, later this data can maybe be fetched from google analytics
const highlightedItems = [
  'Table',
  'Chart',
  'Button',
  'Filter field',
  'Card',
  'Icon',
  'Changelog',
  'Get started',
  'Colors',
  'Icons',
  'Common UI styles',
  'Theming',
];

const navigationOrder = ['Brand', 'Resources', 'Components', 'Patterns'];

/** add the sidenav to each page */
function addSidenavToPages(
  files: string[],
  sidenavContent: BaCategoryNavigation,
  path: string,
): void {
  for (const file of files) {
    const filepath = join(path, file);
    if (!lstatSync(filepath).isDirectory()) {
      let currentSidenav = sidenavContent;
      const content = JSON.parse(readFileSync(filepath).toString());
      const fileTitle = content.title;

      // highlight active item
      for (const section of currentSidenav.sections) {
        for (const item of section.items) {
          if (item.title == fileTitle) {
            item.active = true;
          } else {
            item.active = false;
          }
        }
      }

      // add sidenav to the json file
      content.sidenav = currentSidenav;
      fs.writeFile(join(path, file), JSON.stringify(content, null, 2), {
        flag: 'w', // "w" -> Create file if it does not exist
        encoding: 'utf8',
      });

      // if there are subpages, add a sidenav to each of them
      const pathToSubfolder = join(path, file.replace(/\.[^/.]+$/, ''));
      if (
        existsSync(pathToSubfolder) &&
        lstatSync(pathToSubfolder).isDirectory()
      ) {
        const subPages = readdirSync(pathToSubfolder);
        for (const subPage of subPages) {
          const subPagePath = join(pathToSubfolder, subPage);
          const subPageContent = JSON.parse(
            readFileSync(subPagePath).toString(),
          );
          subPageContent.sidenav = currentSidenav;
          fs.writeFile(subPagePath, JSON.stringify(subPageContent, null, 2), {
            flag: 'w', // "w" -> Create file if it does not exist
            encoding: 'utf8',
          });
        }
      }
    }
  }
}

function orderSectionItems(
  categoryNav: BaCategoryNavigation,
): BaCategoryNavigation {
  // sort all items by order, if an item doesn't have an order it should come
  // last. If more than one item doesn't have an order they are sorted alphabetically.
  for (const section of categoryNav.sections) {
    const sectionItems = section.items;
    sectionItems.sort(function(
      a: BaCategoryNavigationSectionItem,
      b: BaCategoryNavigationSectionItem,
    ): number {
      if (a.order && b.order) {
        return a.order - b.order;
      }

      if (b.order) {
        return 1;
      }

      if (a.order) {
        return -1;
      }

      return a.title.localeCompare(b.title);
    });
    section.items = sectionItems;
  }
  return categoryNav;
}

function getOverviewSectionItem(
  filecontent: BaSinglePageMeta,
  section: string,
  filepath: string,
): BaCategoryNavigationSectionItem {
  let properties =
    filecontent.properties && filecontent.properties.length > 0
      ? [...filecontent.properties]
      : [];
  if (highlightedItems.includes(filecontent.title)) {
    properties.push('favorite');
  }

  return {
    title: filecontent.title,
    identifier:
      filecontent.title && filecontent.title.length > 1
        ? filecontent.title[0] + filecontent.title[1]
        : 'Id',
    description: filecontent.description || '',
    section: section,
    link: filepath,
    badge: properties,
    order: filecontent.order,
  };
}

/** Check if given path is a directory within DIST_DIR. */
function isDirectory(path: string): boolean {
  try {
    return lstatSync(join(DIST_DIR, path)).isDirectory();
  } catch {
    return false;
  }
}

/** Builds overview pages */
export const overviewBuilder = async () => {
  const allDirectories = readdirSync(DIST_DIR).filter(dirPath =>
    isDirectory(dirPath),
  );

  let nav: BaNav = {
    navItems: [],
  };

  const pages = allDirectories.map(async directory => {
    const path = join(DIST_DIR, directory);
    let overviewPage: BaCategoryNavigation;
    const files = readdirSync(path);

    const capitalizedTitle =
      directory.charAt(0).toUpperCase() + directory.slice(1);

    nav.navItems.push({
      label: capitalizedTitle,
      url: `/${directory}/`,
      order: navigationOrder.indexOf(capitalizedTitle) + 1,
    });

    if (directory !== 'components') {
      overviewPage = {
        title: capitalizedTitle,
        id: directory,
        layout: 'overview',
        sections: [
          {
            items: [],
          },
        ],
      };

      for (const file of files) {
        if (file.indexOf('.') > 0) {
          const filepath = join(directory, file.replace(/\.[^/.]+$/, ''));
          const content = JSON.parse(readFileSync(join(path, file)).toString());
          overviewPage.sections[0].items.push(
            getOverviewSectionItem(content, capitalizedTitle, filepath),
          );
        }
      }
    } else {
      overviewPage = {
        title: 'Components',
        id: 'components',
        layout: 'overview',
        description:
          'Read all about development with/of our Angular components in how to get started. If you run into any troubles or want to contribute, please visit our GitHub page.',
        sections: [
          {
            title: 'Documentation',
            items: [],
          },
          {
            title: 'Components',
            items: [],
          },
          {
            title: 'Angular resources',
            items: [],
          },
        ],
      };

      for (const file of files) {
        const content = JSON.parse(readFileSync(join(path, file)).toString());
        for (const section of overviewPage.sections) {
          const filepath = join(directory, file.replace(/\.[^/.]+$/, ''));
          if (
            content.navGroup === 'docs' &&
            section.title === 'Documentation'
          ) {
            section.items.push(
              getOverviewSectionItem(content, section.title, filepath),
            );
          } else if (
            content.navGroup === 'other' &&
            section.title === 'Angular resources'
          ) {
            section.items.push(
              getOverviewSectionItem(content, 'Angular resource', filepath),
            );
          } else if (section.title === 'Components' && !content.navGroup) {
            section.items.push(
              getOverviewSectionItem(content, 'Component', filepath),
            );
          }
        }
      }
    }

    overviewPage = orderSectionItems(overviewPage!);

    addSidenavToPages(files, overviewPage, path);

    const overviewfilepath = join(DIST_DIR, `${directory}.json`);
    // Write file with page content to disc.
    return fs.writeFile(
      overviewfilepath,
      JSON.stringify(overviewPage, null, 2),
      {
        flag: 'w', // "w" -> Create file if it does not exist
        encoding: 'utf8',
      },
    );
  });

  nav.navItems = nav.navItems.sort(function(
    a: BaNavItem,
    b: BaNavItem,
  ): number {
    if (a.order && b.order) {
      return a.order - b.order;
    }

    if (b.order) {
      return 1;
    }

    return -1;
  });

  await fs.writeFile(join(DIST_DIR, 'nav.json'), JSON.stringify(nav, null, 2), {
    flag: 'w', // "w" -> Create file if it does not exist
    encoding: 'utf8',
  });

  return Promise.all(pages);
};
