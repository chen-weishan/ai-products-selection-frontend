import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'percentZh'
})
export class PercentZhPipe implements PipeTransform {

  transform(value: unknown, ...args: unknown[]): unknown {
    return null;
  }

}
