import { Component, ViewEncapsulation } from '@angular/core';

class Setting {
  public label: string;
  public symbol: string;
  public defaultValue: boolean | number;
  public type: 'number' | 'boolean';
  public min?: number;
  public max?: number;
  public value: boolean | number;
}

class Animation {
  public id: number;
  public title: string;
  public author: string;
  public url: string;
  public preview: string;
  public settings: Setting[];
}

const APP_ANIMATIONS: Animation[] = [
  {
    id: 0,
    title: 'DropLines',
    author: 'Bruno & Miguel',
    url: 'droplines.html',
    preview: 'assets/DropLines.png',
    settings: [
      {
        label: 'Color',
        symbol: 'hue',
        defaultValue: 123,
        type: 'number',
        min: 0,
        max: 360,
        value: 123,
      },
      {
        label: 'Animate Color',
        symbol: 'rotateHue',
        defaultValue: false,
        type: 'boolean',
        value: false,
      },
      {
        label: 'Density',
        symbol: 'density',
        defaultValue: 5,
        type: 'number',
        min: 1,
        max: 10,
        value: 5,
      },
    ],
  },
  {
    id: 1,
    title: 'Symbols',
    author: 'Bruno',
    url: 'symbols.html',
    preview: 'assets/Symbols.png',
    settings: [
      {
        label: 'Color',
        symbol: 'hue',
        defaultValue: 192,
        type: 'number',
        min: 0,
        max: 360,
        value: 192,
      },
      {
        label: 'Animate Color',
        symbol: 'rotateHue',
        defaultValue: false,
        type: 'boolean',
        value: false,
      },
      {
        label: 'Density',
        symbol: 'density',
        defaultValue: 5,
        type: 'number',
        min: 1,
        max: 100,
        value: 50,
      },
    ],
  },
  {
    id: 2,
    title: 'Desktop Aurora',
    author: 'Bruno',
    url: 'aurora.html',
    preview: 'assets/aurora.png',
    settings: [
    ],
  },
  {
    id: 3,
    title: 'Dawn',
    author: 'Bruno',
    url: 'dawn.html',
    preview: 'assets/dawn.png',
    settings: [
    ],
  },
];

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class AppComponent {
  public currentAnimation: Animation;
  public animations = APP_ANIMATIONS;
  public currentUrl: string;

  constructor() {
    this.verifyHash();
    window.onhashchange = () => this.verifyHash();
  }

  public updateUrl(): void {
    if (this.currentAnimation) {
      this.currentUrl = `animations/${
        this.currentAnimation.url
      }#${this.currentAnimation.settings.reduce((prev, curr) => {
        const willAdd = curr.defaultValue !== curr.value;
        if (willAdd) {
          prev +=
            prev !== ''
              ? `&${curr.symbol}=${curr.value}`
              : `${curr.symbol}=${curr.value}`;
        }

        return prev;
      }, '')}`;
    }
  }

  public reset(): void {
    window.location.hash = '';
  }

  private verifyHash(): void {
    const itemId = this.getHashId();
    if (itemId !== undefined) {
      this.currentAnimation = this.animations.find((ann) => ann.id === itemId);
      this.updateUrl();
    } else {
      this.currentAnimation = undefined;
    }
  }

  private getHashId(): number | undefined {
    const itemId = window.location.hash.slice(1);
    const result = parseInt(itemId, 10);
    if (itemId !== '' && !isNaN(result)) {
      return result;
    }

    return undefined;
  }
}
