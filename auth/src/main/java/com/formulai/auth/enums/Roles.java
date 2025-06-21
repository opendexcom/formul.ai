package com.formulai.auth.enums;

import lombok.Getter;

@Getter
public enum Roles {
    ROLE_AUTHOR("ROLE_AUTHOR"),
    ROLE_PUBLIC("ROLE_PUBLIC");

    private final String roleName;

    Roles(String roleName) {
        this.roleName = roleName;
    }

    @Override
    public String toString() {
        return roleName;
    }

}
