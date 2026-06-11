import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { LoginComponent } from './login.component';
import { AuthService, Rol } from '../../../core/auth';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let componente: LoginComponent;
  let authSpy: jasmine.SpyObj<AuthService>;
  let router: Router;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj<AuthService>('AuthService', ['login']);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: authSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    componente = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('se crea', () => {
    expect(componente).toBeTruthy();
  });

  it('NO llama a la API con el formulario vacío', () => {
    componente.enviar();
    expect(authSpy.login).not.toHaveBeenCalled();
  });

  it('NO llama a la API con un email inválido', () => {
    componente['formulario'].setValue({ email: 'no-es-un-email', password: 'Secreta123!' });
    componente.enviar();
    expect(authSpy.login).not.toHaveBeenCalled();
  });

  it('con credenciales válidas llama a login y redirige a la home del rol', () => {
    authSpy.login.and.returnValue(
      of({
        accessToken: 'a',
        refreshToken: 'r',
        usuario: {
          id: 'u1',
          nombre: 'Admin',
          apellido: 'BusRide',
          email: 'admin@busride.do',
          rol: Rol.ADMIN,
        },
      }),
    );
    const navegar = spyOn(router, 'navigateByUrl').and.resolveTo(true);

    componente['formulario'].setValue({ email: 'admin@busride.do', password: 'Admin123!cambiar' });
    componente.enviar();

    expect(authSpy.login).toHaveBeenCalledOnceWith({
      email: 'admin@busride.do',
      password: 'Admin123!cambiar',
    });
    expect(navegar).toHaveBeenCalledOnceWith('/panel');
  });

  it('muestra el mensaje del backend cuando el login falla', () => {
    authSpy.login.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            error: { message: 'Credenciales inválidas' },
          }),
      ),
    );

    componente['formulario'].setValue({ email: 'x@y.com', password: 'incorrecta' });
    componente.enviar();
    fixture.detectChanges();

    expect(componente['errorBackend']()).toBe('Credenciales inválidas');
    expect(componente['cargando']()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Credenciales inválidas');
  });
});
