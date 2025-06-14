package com.formulai.auth.repository;

import com.formulai.auth.model.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface UserRoleRepository extends JpaRepository<UserRole, UUID> {
    Optional<UserRole> findByName(String name);
}
