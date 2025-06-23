package com.formulai.auth.unit;

import com.formulai.auth.AuthApplication;
import com.formulai.auth.model.User;
import com.formulai.auth.model.UserRole;
import com.formulai.auth.repository.UserRepository;
import com.formulai.auth.repository.UserRoleRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class AuthApplicationTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserRoleRepository userRoleRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private AuthApplication authApplication;

    @Captor
    private ArgumentCaptor<User> userCaptor;

    @Test
    void shouldCreateOpenApiConfiguration() {
        // when
        var openApi = authApplication.customOpenAPI();

        // then
        assertNotNull(openApi);
        assertEquals("Auth API", openApi.getInfo().getTitle());
        assertEquals("1.0", openApi.getInfo().getVersion());
        assertEquals(1, openApi.getServers().size());
        assertEquals("http://localhost/api/auth", openApi.getServers().get(0).getUrl());
    }

    @Test
    void shouldUseExistingRoleIfPresent() throws Exception {
        // given
        String email = "test@test.pl";
        UserRole existingRole = UserRole.builder()
                .id(UUID.randomUUID())
                .name("ROLE_AUTHOR")
                .build();

        when(userRepository.findByEmail(email)).thenReturn(Optional.empty());
        when(userRoleRepository.findByName("ROLE_AUTHOR")).thenReturn(Optional.of(existingRole));
        when(passwordEncoder.encode(anyString())).thenReturn("password");

        // when
        CommandLineRunner runner = authApplication.insertDummyUser(userRepository, userRoleRepository, passwordEncoder);
        runner.run();

        // then
        verify(userRepository).save(userCaptor.capture());
        User savedUser = userCaptor.getValue();
        verify(userRoleRepository, never()).save(any(UserRole.class));
        assertTrue(savedUser.getRoles().contains(existingRole));
    }

    @Test
    void shouldCreateDummyUserWhenNotExists() throws Exception {
        // given
        String email = "test@test.pl";
        when(userRepository.findByEmail(email)).thenReturn(Optional.empty());
        when(userRoleRepository.findByName("ROLE_AUTHOR")).thenReturn(Optional.empty());
        when(userRoleRepository.save(any(UserRole.class))).thenReturn(
                UserRole.builder().id(UUID.randomUUID()).name("ROLE_AUTHOR").build()
        );
        when(passwordEncoder.encode(anyString())).thenReturn("encoded-password");

        // when
        CommandLineRunner runner = authApplication.insertDummyUser(userRepository, userRoleRepository, passwordEncoder);
        runner.run();

        // then
        verify(userRepository).save(userCaptor.capture());
        User savedUser = userCaptor.getValue();
        assertEquals(email, savedUser.getEmail());
        assertEquals("encoded-password", savedUser.getPassword());
        assertEquals(1, savedUser.getRoles().size());
        assertTrue(savedUser.getRoles().stream().anyMatch(role -> "ROLE_AUTHOR".equals(role.getName())));
    }

    @Test
    void shouldNotCreateDummyUserWhenAlreadyExists() throws Exception {
        // given
        String email = "test@test.pl";
        User existingUser = new User();
        when(userRepository.findByEmail(email)).thenReturn(Optional.of(existingUser));

        // when
        CommandLineRunner runner = authApplication.insertDummyUser(userRepository, userRoleRepository, passwordEncoder);
        runner.run();

        // then
        verify(userRepository, never()).save(any(User.class));
    }
}
