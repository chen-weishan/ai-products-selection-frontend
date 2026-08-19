import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'scoreGrade'
})
export class ScoreGradePipe implements PipeTransform {

  transform(value: unknown, ...args: unknown[]): unknown {
    return null;
  }

}
