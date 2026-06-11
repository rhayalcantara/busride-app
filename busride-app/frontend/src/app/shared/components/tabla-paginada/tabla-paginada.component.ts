import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  TemplateRef,
  computed,
  contentChildren,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';

/** Definición de una columna de la tabla. */
export interface ColumnaTabla<T = unknown> {
  /** Clave única; por defecto se usa como propiedad de la fila. */
  clave: string;
  encabezado: string;
  /** Acceso personalizado al valor (si la clave no es una propiedad directa). */
  valor?: (fila: T) => unknown;
}

/** Contexto disponible dentro de un template de celda proyectado. */
export interface ContextoCeldaTabla<T = unknown> {
  $implicit: T;
  columna: ColumnaTabla<T>;
}

/**
 * Marca un `ng-template` proyectado como renderizador de la celda de una
 * columna:
 *
 * ```html
 * <app-tabla-paginada [columnas]="columnas" [datos]="filas">
 *   <ng-template appCeldaTabla="acciones" let-fila>
 *     <button mat-icon-button (click)="editar(fila)">...</button>
 *   </ng-template>
 * </app-tabla-paginada>
 * ```
 */
@Directive({ selector: 'ng-template[appCeldaTabla]', standalone: true })
export class CeldaTablaDirective {
  /** Clave de la columna a la que aplica este template. */
  readonly clave = input.required<string>({ alias: 'appCeldaTabla' });

  readonly plantilla = inject<TemplateRef<ContextoCeldaTabla>>(TemplateRef);

  static ngTemplateContextGuard(
    _directiva: CeldaTablaDirective,
    contexto: unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): contexto is ContextoCeldaTabla<any> {
    return true;
  }
}

/**
 * Tabla Material genérica con paginador.
 *
 * Las columnas se configuran por input; cualquier columna puede sobreescribir
 * su renderizado proyectando un `ng-template[appCeldaTabla]` con la clave de
 * la columna. Sin template, se muestra `fila[clave]` (o `columna.valor(fila)`).
 */
@Component({
  selector: 'app-tabla-paginada',
  standalone: true,
  imports: [MatTableModule, MatPaginatorModule, NgTemplateOutlet],
  template: `
    <div class="tabla-paginada">
      <table mat-table [dataSource]="dataSource">
        @for (col of columnas(); track col.clave) {
          <ng-container [matColumnDef]="col.clave">
            <th mat-header-cell *matHeaderCellDef>{{ col.encabezado }}</th>
            <td mat-cell *matCellDef="let fila">
              @if (plantillas().get(col.clave); as plantilla) {
                <ng-container
                  *ngTemplateOutlet="plantilla; context: { $implicit: fila, columna: col }"
                />
              } @else {
                {{ valorCelda(fila, col) }}
              }
            </td>
          </ng-container>
        }

        <tr mat-header-row *matHeaderRowDef="clavesColumnas()"></tr>
        <tr mat-row *matRowDef="let fila; columns: clavesColumnas()"></tr>
      </table>

      <mat-paginator
        [pageSize]="tamanoPagina()"
        [pageSizeOptions]="opcionesPagina()"
        showFirstLastButtons
        aria-label="Seleccionar página"
      />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .tabla-paginada {
        overflow-x: auto;
      }
      table {
        width: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablaPaginadaComponent<T> {
  readonly columnas = input.required<ColumnaTabla<T>[]>();
  readonly datos = input<T[]>([]);
  readonly tamanoPagina = input(10);
  readonly opcionesPagina = input<number[]>([5, 10, 25, 50]);

  /** Templates de celda proyectados por el consumidor. */
  private readonly celdasProyectadas = contentChildren(CeldaTablaDirective);

  private readonly paginator = viewChild(MatPaginator);

  readonly dataSource = new MatTableDataSource<T>([]);

  readonly clavesColumnas = computed(() => this.columnas().map((col) => col.clave));

  readonly plantillas = computed(
    () =>
      new Map<string, TemplateRef<ContextoCeldaTabla>>(
        this.celdasProyectadas().map((celda) => [celda.clave(), celda.plantilla]),
      ),
  );

  constructor() {
    effect(() => {
      this.dataSource.data = this.datos();
    });
    effect(() => {
      this.dataSource.paginator = this.paginator() ?? null;
    });
  }

  valorCelda(fila: T, columna: ColumnaTabla<T>): string {
    const valor = columna.valor
      ? columna.valor(fila)
      : (fila as Record<string, unknown>)[columna.clave];
    return valor === null || valor === undefined ? '' : String(valor);
  }
}
